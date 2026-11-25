"""HTTP inference wrapper for the unified person + fall detection pipeline.

Reuses the existing models and inference code:
  - YOLOv8n (person + baggage tracking) from AI/Baggage_And_Person_Detector/
  - MediaPipe Pose + Random Forest fall model from AI/fulldetection/

Endpoints:
  GET    /health                              — model availability + service health
  POST   /process                             — process a single frame (base64 JPEG)
  POST   /stream/start                        — start continuous processing from a source
  POST   /stream/stop                         — stop a continuous stream
  GET    /streams                             — list active streams

Run (from AI/unified_detection/, requires ultralytics + mediapipe + opencv + fastapi):
    python -m uvicorn inference_server:app --host 0.0.0.0 --port 8004
"""

from __future__ import annotations

import asyncio
import base64
import io
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from pipeline import (
    CooldownTracker,
    PipelineEvent,
    UnifiedPipeline,
)
from TrackerEngine import AirportTrackerEngine

app = FastAPI(title="Unified Person + Fall Detection", version="1.0.0")

# Single pipeline instance — models loaded exactly once per process.
_PIPELINE: Optional[UnifiedPipeline] = None
_PIPELINE_LOCK = asyncio.Lock()

# Airport Tracker Engine instances (per camera)
_TRACKER_ENGINES: Dict[int, AirportTrackerEngine] = {}
_TRACKER_LOCK = asyncio.Lock()

# Active continuous streams: stream_id -> {task, camera_id, source, running}
_ACTIVE_STREAMS: Dict[str, Dict[str, Any]] = {}
_STREAMS_LOCK = asyncio.Lock()

MAX_FRAME_BYTES = 10 * 1024 * 1024  # 10 MB


class ProcessFrameRequest(BaseModel):
    image_base64: str
    camera_id: int = 0
    source_id: Optional[str] = None


class StartStreamRequest(BaseModel):
    source: str  # camera index (e.g. "0"), video file path, or RTSP URL
    camera_id: int = 0
    source_id: Optional[str] = None


def _get_pipeline() -> UnifiedPipeline:
    global _PIPELINE
    if _PIPELINE is None:
        _PIPELINE = UnifiedPipeline(
            config_path="config.yaml",
            backend_url=None,  # set via STARTUP_BACKEND_URL env
        )
    return _PIPELINE


@app.on_event("startup")
async def _startup() -> None:
    import os

    backend_url = os.getenv("STARTUP_BACKEND_URL")
    global _PIPELINE
    _PIPELINE = UnifiedPipeline(
        config_path="config.yaml",
        backend_url=backend_url,
    )


@app.on_event("shutdown")
async def _shutdown() -> None:
    global _PIPELINE
    if _PIPELINE is not None:
        await _PIPELINE.close()
        _PIPELINE = None
    async with _STREAMS_LOCK:
        for stream in _ACTIVE_STREAMS.values():
            stream["running"] = False
        _ACTIVE_STREAMS.clear()


@app.get("/health")
async def health() -> Dict[str, Any]:
    """Health check. Reports model availability and service configuration."""
    pipe = _get_pipeline()
    models_ok = True
    details: List[str] = []
    try:
        # Initialize SharedDetector on check if not yet loaded
        if pipe.shared_detector is None:
            from Detector import SharedDetector
            pipe.shared_detector = SharedDetector(
                model_path=pipe._shared_detector_model_path,
                conf=pipe._shared_detector_conf,
            )
            pipe._shared_detector_loaded = True

        if pipe.shared_detector is None or pipe.shared_detector.model is None:
            models_ok = False
            details.append("shared_detector model not loaded")
        # Verify fall model file exists
        from pathlib import Path as _P
        if not _P(pipe.fall_model_path).exists():
            models_ok = False
            details.append(f"fall model not found: {pipe.fall_model_path}")
    except Exception as exc:  # noqa: BLE001
        models_ok = False
        details.append(f"model check failed: {exc}")

    return {
        "status": "ok" if models_ok else "degraded",
        "service": "unified_detection",
        "port": 8004,
        "models": {
            "person_object_detector": "yolov8n.pt",
            "fall_detector": "rf_fall_model.joblib + pose_landmarker_lite.task",
        },
        "models_ok": models_ok,
        "details": details,
        "target_fps": pipe.target_fps,
        "confidence_threshold": pipe.conf_threshold,
        "active_cameras": len(pipe.camera_states),
        "active_streams": len(_ACTIVE_STREAMS),
        "backend_url": pipe.backend_url,
    }


@app.post("/process")
async def process_frame(
    req: ProcessFrameRequest,
) -> JSONResponse:
    """Process a single base64-encoded JPEG frame and return detected events."""
    pipe = _get_pipeline()

    try:
        img_bytes = base64.b64decode(req.image_base64)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {exc}")

    if len(img_bytes) > MAX_FRAME_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Frame too large: {len(img_bytes)} bytes (max {MAX_FRAME_BYTES}).",
        )

    try:
        pil_img = __import__("PIL.Image", fromlist=["Image"]).open(
            io.BytesIO(img_bytes)
        ).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}")

    frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    fh, fw = frame.shape[:2]

    # Process through AirportTrackerEngine (ByteTrack + Person-to-Baggage Spatial-Temporal Association)
    async with _TRACKER_LOCK:
        if req.camera_id not in _TRACKER_ENGINES:
            _TRACKER_ENGINES[req.camera_id] = AirportTrackerEngine()
        tracker = _TRACKER_ENGINES[req.camera_id]

    tracker_result = await asyncio.to_thread(tracker.process_frame, frame)

    events = await pipe.process_frame(
        frame=frame,
        camera_id=req.camera_id,
        source_id=req.source_id,
    )

    # Emit to backend if configured
    if pipe.backend_url and events:
        await pipe.emit_events(events)

    return JSONResponse(
        {
            "camera_id": req.camera_id,
            "frame_width": fw,
            "frame_height": fh,
            "event_count": len(events),
            "events": [
                {
                    "event_id": ev.event_id,
                    "event_type": ev.event_type,
                    "tracking_id": ev.tracking_id,
                    "confidence": ev.confidence,
                    "timestamp": ev.timestamp,
                    "payload": ev.payload,
                }
                for ev in events
            ],
            "tracker": tracker_result,
        }
    )


@app.post("/process/upload")
async def process_frame_upload(
    image: UploadFile = File(...),
    camera_id: int = 0,
    source_id: Optional[str] = None,
) -> JSONResponse:
    """Process a single uploaded image frame (multipart form)."""
    pipe = _get_pipeline()

    if image.content_type not in {"image/jpeg", "image/jpg", "image/png"}:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{image.content_type}'. Use JPEG or PNG.",
        )

    contents = await image.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty image file.")
    if len(contents) > MAX_FRAME_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large: {len(contents)} bytes (max {MAX_FRAME_BYTES}).",
        )

    try:
        from PIL import Image

        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}")

    frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    events = await pipe.process_frame(
        frame=frame,
        camera_id=camera_id,
        source_id=source_id,
    )

    if pipe.backend_url and events:
        await pipe.emit_events(events)

    return JSONResponse(
        {
            "camera_id": camera_id,
            "event_count": len(events),
            "events": [
                {
                    "event_id": ev.event_id,
                    "event_type": ev.event_type,
                    "tracking_id": ev.tracking_id,
                    "confidence": ev.confidence,
                    "timestamp": ev.timestamp,
                    "payload": ev.payload,
                }
                for ev in events
            ],
        }
    )


@app.post("/stream/start")
async def start_stream(
    req: StartStreamRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Start continuous frame processing from a camera/video/RTSP source.

    Returns a stream_id that can be used with /stream/stop.
    """
    pipe = _get_pipeline()
    stream_id = f"stream_{uuid.uuid4().hex[:8]}"

    async def _stream_loop() -> None:
        source = int(req.source) if req.source.isdigit() else req.source
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            async with _STREAMS_LOCK:
                if stream_id in _ACTIVE_STREAMS:
                    _ACTIVE_STREAMS[stream_id]["running"] = False
                    _ACTIVE_STREAMS[stream_id]["error"] = (
                        f"Cannot open source: {req.source}"
                    )
            return

        async with _STREAMS_LOCK:
            _ACTIVE_STREAMS[stream_id] = {
                "task": asyncio.current_task(),
                "camera_id": req.camera_id,
                "source": req.source,
                "source_id": req.source_id,
                "running": True,
                "error": None,
                "frames_processed": 0,
                "started_at": time.time(),
            }

        frame_interval = 1.0 / pipe.target_fps
        try:
            while True:
                async with _STREAMS_LOCK:
                    if not _ACTIVE_STREAMS.get(stream_id, {}).get("running", False):
                        break
                ok, frame = cap.read()
                if not ok:
                    break

                now = time.time()
                events = await pipe.process_frame(
                    frame=frame,
                    camera_id=req.camera_id,
                    source_id=req.source_id,
                    timestamp=now,
                )

                if pipe.backend_url and events:
                    await pipe.emit_events(events)

                async with _STREAMS_LOCK:
                    if stream_id in _ACTIVE_STREAMS:
                        _ACTIVE_STREAMS[stream_id]["frames_processed"] += 1

                elapsed = time.time() - now
                sleep_time = frame_interval - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
        except Exception as exc:  # noqa: BLE001
            async with _STREAMS_LOCK:
                if stream_id in _ACTIVE_STREAMS:
                    _ACTIVE_STREAMS[stream_id]["error"] = str(exc)
                    _ACTIVE_STREAMS[stream_id]["running"] = False
        finally:
            cap.release()
            async with _STREAMS_LOCK:
                if stream_id in _ACTIVE_STREAMS:
                    _ACTIVE_STREAMS[stream_id]["running"] = False

    task = asyncio.create_task(_stream_loop())
    background_tasks.add_task(lambda: task)

    return {
        "stream_id": stream_id,
        "status": "started",
        "source": req.source,
        "camera_id": req.camera_id,
    }


@app.post("/stream/stop")
async def stop_stream(stream_id: str) -> Dict[str, Any]:
    """Stop a continuous stream by stream_id."""
    async with _STREAMS_LOCK:
        if stream_id not in _ACTIVE_STREAMS:
            raise HTTPException(status_code=404, detail=f"Stream {stream_id} not found")
        _ACTIVE_STREAMS[stream_id]["running"] = False
    return {"stream_id": stream_id, "status": "stopping"}


@app.get("/streams")
async def list_streams() -> Dict[str, Any]:
    """List active continuous streams."""
    async with _STREAMS_LOCK:
        streams = {
            sid: {
                "camera_id": s["camera_id"],
                "source": s["source"],
                "source_id": s["source_id"],
                "running": s["running"],
                "error": s["error"],
                "frames_processed": s["frames_processed"],
                "started_at": s["started_at"],
            }
            for sid, s in _ACTIVE_STREAMS.items()
        }
    return {"streams": streams, "count": len(streams)}

