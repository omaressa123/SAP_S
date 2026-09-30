"""
Stage 1 — Pose extraction (no training needed).

Runs MediaPipe Pose over every video in --input_dir and saves one .npy file per video
containing the per-frame keypoint array of shape (num_frames, 33, 3) -> (x, y, visibility).

Usage:
    python src/pose_extraction.py --input_dir data/raw/le2i --output_dir data/processed/keypoints
"""

import argparse
from pathlib import Path
from urllib.request import urlretrieve

import cv2
import numpy as np
import mediapipe as mp
from tqdm import tqdm

from utils import find_videos, load_config

POSE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)
POSE_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "pose_landmarker_lite.task"


def extract_video_keypoints(video_path, pose_model, timestamp_offset=0):
    cap = cv2.VideoCapture(str(video_path))
    frames_keypoints = []
    timestamp_ms = timestamp_offset

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = pose_model.detect_for_video(image, timestamp_ms)
        timestamp_ms += 1

        if result.pose_landmarks:
            kp = np.array(
                [[lm.x, lm.y, lm.visibility] for lm in result.pose_landmarks[0]],
                dtype=np.float32,
            )
        else:
            # No person detected in this frame — fill with NaNs, handled downstream
            kp = np.full((33, 3), np.nan, dtype=np.float32)

        frames_keypoints.append(kp)

    cap.release()
    return np.stack(frames_keypoints) if frames_keypoints else np.zeros((0, 33, 3), dtype=np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_dir", required=True, help="Directory containing source videos (searched recursively)")
    parser.add_argument("--output_dir", required=True, help="Where to write per-video .npy keypoint files")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config) if Path(args.config).exists() else {}
    pose_cfg = cfg.get("pose", {})

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    input_dir = Path(args.input_dir).resolve()

    videos = find_videos(args.input_dir)
    if not videos:
        print(f"No videos found under {args.input_dir}")
        return

    if not POSE_MODEL_PATH.exists():
        POSE_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading pose model to {POSE_MODEL_PATH}...")
        urlretrieve(POSE_MODEL_URL, POSE_MODEL_PATH)

    base_options = mp.tasks.BaseOptions(model_asset_path=str(POSE_MODEL_PATH))
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=pose_cfg.get("min_detection_confidence", 0.5),
        min_pose_presence_confidence=pose_cfg.get("min_detection_confidence", 0.5),
        min_tracking_confidence=pose_cfg.get("min_tracking_confidence", 0.5),
    )
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as pose_model:
        for video_index, video_path in enumerate(tqdm(videos, desc="Extracting pose keypoints")):
            relative_path = video_path.resolve().relative_to(input_dir)
            out_path = (output_dir / relative_path).with_suffix(".npy")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            if out_path.exists():
                continue  # resume-friendly
            keypoints = extract_video_keypoints(video_path, pose_model, video_index * 10_000_000)
            np.save(out_path, keypoints)

    print(f"Done. Keypoints saved to {output_dir}")


if __name__ == "__main__":
    main()