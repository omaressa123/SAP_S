#!/usr/bin/env python3
"""Local browser interface for the trained pose-based fall detector."""

import argparse
import cgi
import json
import mimetypes
import sys
import tempfile
import threading
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
DEFAULT_MODEL = ROOT / "models" / "rf_fall_model.joblib"
DEFAULT_CONFIG = ROOT / "config.yaml"
MAX_UPLOAD_BYTES = 250 * 1024 * 1024
JOBS = {}
JOBS_LOCK = threading.Lock()

sys.path.insert(0, str(ROOT / "src"))
from Realtime_infer import FallDetector  # noqa: E402
from utils import load_config  # noqa: E402


class AppHandler(BaseHTTPRequestHandler):
    model_path = DEFAULT_MODEL
    config = {}

    def _send_bytes(self, body, content_type, status=HTTPStatus.OK):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self._send_bytes(body, "application/json; charset=utf-8", status)

    @staticmethod
    def _job_snapshot(job_id):
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            return dict(job) if job else None

    @staticmethod
    def _update_job(job_id, **updates):
        with JOBS_LOCK:
            if job_id in JOBS:
                JOBS[job_id].update(updates)

    @classmethod
    def _analyze_job(cls, job_id, temp_path, filename):
        detector = None
        capture = None
        try:
            detector = FallDetector(cls.model_path, cls.config)
            capture = cv2.VideoCapture(str(temp_path))
            if not capture.isOpened():
                raise ValueError("The uploaded file could not be opened as a video.")

            fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
            if fps <= 0:
                fps = cls.config.get("capture", {}).get("target_fps", 15)
            total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            cls._update_job(job_id, status="processing", total_frames=total_frames, fps=fps)

            events = []
            frame_index = 0
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                event_status = detector.process_frame(frame)
                if event_status:
                    event = {
                        "status": event_status,
                        "seconds": round(frame_index / fps, 2),
                    }
                    events.append(event)
                    cls._update_job(job_id, events=list(events), latest_event=event)
                frame_index += 1
                if frame_index % 3 == 0 or event_status:
                    cls._update_job(job_id, processed_frames=frame_index)

            confirmed = [event for event in events if event["status"] == "confirmed_fall"]
            cls._update_job(
                job_id,
                status="completed",
                processed_frames=frame_index,
                frames=frame_index,
                total_frames=frame_index,
                duration_seconds=round(frame_index / fps, 2),
                confirmed_falls=len(confirmed),
                summary="Confirmed fall detected" if confirmed else "No confirmed fall detected",
                events=events,
            )
        except Exception as exc:
            cls._update_job(job_id, status="failed", error=str(exc))
        finally:
            if capture is not None:
                capture.release()
            if detector is not None:
                detector.mp_pose.close()
            temp_path.unlink(missing_ok=True)

    def do_GET(self):
        relative_path = self.path.split("?", 1)[0]
        if relative_path.startswith("/api/jobs/"):
            job_id = relative_path.removeprefix("/api/jobs/")
            snapshot = self._job_snapshot(job_id)
            if snapshot is None:
                self._send_json({"error": "Analysis job not found."}, HTTPStatus.NOT_FOUND)
            else:
                self._send_json(snapshot)
            return
        if relative_path == "/":
            relative_path = "/index.html"

        requested = (WEB_DIR / relative_path.lstrip("/")).resolve()
        if WEB_DIR not in requested.parents or not requested.is_file():
            self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return

        content_type = mimetypes.guess_type(requested.name)[0] or "application/octet-stream"
        self._send_bytes(requested.read_bytes(), content_type)

    def do_POST(self):
        if self.path != "/api/analyze":
            self._send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_UPLOAD_BYTES:
            self._send_json({"error": "Video is missing or larger than 250 MB."}, HTTPStatus.BAD_REQUEST)
            return

        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            self._send_json({"error": "Expected a multipart video upload."}, HTTPStatus.BAD_REQUEST)
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type},
        )
        upload = form["video"] if "video" in form else None
        if upload is None or not getattr(upload, "file", None):
            self._send_json({"error": "Choose a video before analyzing."}, HTTPStatus.BAD_REQUEST)
            return

        suffix = Path(upload.filename or "video.mp4").suffix.lower()
        if suffix not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
            suffix = ".mp4"

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_path = Path(temp_file.name)
                while True:
                    chunk = upload.file.read(1024 * 1024)
                    if not chunk:
                        break
                    temp_file.write(chunk)

            job_id = uuid.uuid4().hex
            with JOBS_LOCK:
                JOBS[job_id] = {
                    "job_id": job_id,
                    "filename": upload.filename or "uploaded video",
                    "status": "queued",
                    "processed_frames": 0,
                    "total_frames": 0,
                    "events": [],
                    "latest_event": None,
                }
            worker = threading.Thread(
                target=self._analyze_job,
                args=(job_id, temp_path, upload.filename or "uploaded video"),
                daemon=True,
            )
            worker.start()
            temp_path = None
            self._send_json({"job_id": job_id, "status": "queued"}, HTTPStatus.ACCEPTED)
        except Exception as exc:
            self._send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string}] {format % args}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--model", default=str(DEFAULT_MODEL))
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    if not model_path.exists():
        raise SystemExit(f"Model not found: {model_path}")

    AppHandler.model_path = model_path
    AppHandler.config = load_config(args.config) if Path(args.config).exists() else {}
    server = ThreadingHTTPServer((args.host, args.port), AppHandler)
    print(f"Open http://{args.host}:{args.port} in your browser")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
