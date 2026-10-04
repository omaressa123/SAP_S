"""
Live pipeline: camera/RTSP stream -> MediaPipe Pose -> features -> sliding window ->
classifier -> post-event stillness confirmation.

Runs continuous frame processing at the configured fps (falls are fast, ~1 second — this
must NOT be periodic snapshot polling).

Usage:
    python src/realtime_infer.py --model models/rf_fall_model.joblib --source 0
    python src/realtime_infer.py --model models/rf_fall_model.joblib --source rtsp://cam-ip/stream
"""

import argparse
import time
from collections import deque
from pathlib import Path

import cv2
import joblib
import numpy as np
import mediapipe as mp

from utils import load_config
from Features import per_frame_features, aggregate_window, centroid_vertical_position

POSE_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "pose_landmarker_lite.task"


class FallDetector:
    def __init__(self, model_path, cfg):
        bundle = joblib.load(model_path)
        self.model = bundle["model"]

        pose_cfg = cfg.get("pose", {})
        base_options = mp.tasks.BaseOptions(model_asset_path=str(POSE_MODEL_PATH))
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=pose_cfg.get("min_detection_confidence", 0.5),
            min_pose_presence_confidence=pose_cfg.get("min_detection_confidence", 0.5),
            min_tracking_confidence=pose_cfg.get("min_tracking_confidence", 0.5),
        )
        self.mp_pose = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        self.timestamp_ms = 0

        win_cfg = cfg.get("windowing", {})
        self.window_frames = win_cfg.get("window_frames", 30)

        capture_cfg = cfg.get("capture", {})
        self.target_fps = capture_cfg.get("target_fps", 15)

        confirm_cfg = cfg.get("confirmation", {})
        self.stillness_check_frames = int(confirm_cfg.get("stillness_check_seconds", 2.5) * self.target_fps)
        self.stillness_threshold = confirm_cfg.get("stillness_movement_threshold", 0.015)

        self.frame_buffer = deque(maxlen=self.window_frames)
        self.pending_confirmation = None  # holds centroid history while confirming a flagged fall

    def _extract_keypoints(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self.mp_pose.detect_for_video(image, self.timestamp_ms)
        self.timestamp_ms += 1
        if result.pose_landmarks:
            return np.array(
                [[lm.x, lm.y, lm.visibility] for lm in result.pose_landmarks[0]],
                dtype=np.float32,
            )
        return np.full((33, 3), np.nan, dtype=np.float32)

    def process_frame(self, frame):
        """
        Feed one frame in. Returns one of: None, "flagged", "confirmed_fall", "false_alarm".
        """
        keypoints = self._extract_keypoints(frame)
        self.frame_buffer.append(keypoints)

        # --- Stillness confirmation in progress? Check it before anything else ---
        if self.pending_confirmation is not None:
            self.pending_confirmation.append(keypoints)
            if len(self.pending_confirmation) >= self.stillness_check_frames:
                centroids = [centroid_vertical_position(kp) for kp in self.pending_confirmation]
                centroids = np.array([c for c in centroids if c is not None and not np.isnan(c)])
                self.pending_confirmation = None

                if len(centroids) < 2:
                    return None  # inconclusive, drop it

                movement = float(np.mean(np.abs(np.diff(centroids))))
                if movement < self.stillness_threshold:
                    return "confirmed_fall"
                return "false_alarm"
            return None  # still collecting stillness-check frames

        # --- Not enough frames yet for a full window ---
        if len(self.frame_buffer) < self.window_frames:
            return None

        window = np.stack(self.frame_buffer)
        feat_dict = per_frame_features(window)
        agg_vector, _ = aggregate_window(feat_dict, 0, self.window_frames)

        prediction = self.model.predict(agg_vector.reshape(1, -1))[0]
        if prediction == 1:
            # Start post-event stillness confirmation — the highest-value false-positive filter
            self.pending_confirmation = [keypoints]
            return "flagged"
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Trained model .joblib from train_rf.py")
    parser.add_argument("--source", default="0", help="Camera index (e.g. 0) or RTSP/video URL")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--display", action="store_true", help="Show a live preview window")
    args = parser.parse_args()

    cfg = load_config(args.config) if Path(args.config).exists() else {}

    detector = FallDetector(args.model, cfg)

    source = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Could not open video source: {args.source}")
        return

    target_fps = cfg.get("capture", {}).get("target_fps", 15)
    frame_interval = 1.0 / target_fps

    print(f"Running live fall detection at {target_fps} fps. Press Ctrl+C to stop.")
    try:
        while True:
            loop_start = time.time()
            ok, frame = cap.read()
            if not ok:
                print("Stream ended or read failed.")
                break

            status = detector.process_frame(frame)
            if status == "flagged":
                print(f"[{time.strftime('%H:%M:%S')}] Fall pattern detected — confirming with stillness check...")
            elif status == "confirmed_fall":
                print(f"[{time.strftime('%H:%M:%S')}] *** CONFIRMED FALL *** -> push to emergency_events")
                # TODO: hook this up to your emergency_events pipeline / alerting system
            elif status == "false_alarm":
                print(f"[{time.strftime('%H:%M:%S')}] Person got back up quickly — false alarm, discarded.")

            if args.display:
                cv2.imshow("Fall Detection", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            elapsed = time.time() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        cap.release()
        detector.mp_pose.close()
        if args.display:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()