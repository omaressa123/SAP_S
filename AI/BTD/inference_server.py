"""HTTP inference wrapper for the existing BTD YOLO11 model.

Reuses the model instance loaded by ``AI/BTD/app.py`` (imported here) so the
YOLO11 weights are loaded exactly once per process rather than duplicated.
The existing Gradio interface in ``app.py`` is left untouched and continues
to work.

Run (from ``AI/BTD/``, requires torch + ultralytics installed):
    python -m uvicorn inference_server:app --host 0.0.0.0 --port 8002
"""
from __future__ import annotations

import asyncio
import io
from typing import Any, Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

# Import the already-loaded model + class list from the existing Gradio app.
# app.py only calls demo.launch() under `if __name__ == "__main__"`, so
# importing it here does NOT start the Gradio UI.
from app import CLASSES, DEFAULT_CONF, model  # noqa: E402

app = FastAPI(title="BTD Baggage Threat Detection Inference", version="1.0.0")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}

# Serialize inference requests so concurrent uploads cannot corrupt the
# shared YOLO model state. Inference itself runs in a worker thread to avoid
# blocking the FastAPI event loop.
_inference_lock = asyncio.Lock()


@app.get("/health")
async def health() -> Dict[str, Any]:
    """Health check. Reports model availability and class labels."""
    return {
        "status": "ok",
        "model": "best.pt",
        "model_type": "YOLO11",
        "classes": CLASSES,
        "num_classes": len(CLASSES),
        "default_confidence": DEFAULT_CONF,
    }


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    conf: float = DEFAULT_CONF,
    iou: float = 0.45,
) -> JSONResponse:
    """Run real YOLO11 inference on an uploaded X-ray image.

    Returns actual detections with class labels and confidence scores.
    Never fabricates detections.
    """
    # --- validate file type ---
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{image.content_type}'. Use JPEG or PNG.",
        )

    # --- read + validate size ---
    contents = await image.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Empty image file.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large: {len(contents)} bytes (max {MAX_UPLOAD_BYTES}).",
        )

    # --- decode image ---
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}") from exc

    # --- validate thresholds ---
    if not (0.0 < conf <= 1.0):
        raise HTTPException(status_code=400, detail="conf must be in (0, 1].")
    if not (0.0 < iou <= 1.0):
        raise HTTPException(status_code=400, detail="iou must be in (0, 1].")

    # --- run inference (serialized, off the event loop) ---
    async with _inference_lock:
        try:
            results = await asyncio.to_thread(
                model.predict,
                pil_image,
                conf=conf,
                iou=iou,
                imgsz=640,
                agnostic_nms=False,
                verbose=False,
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500,
                detail=f"YOLO11 inference failed: {type(exc).__name__}: {exc}",
            ) from exc

    res = results[0]

    # --- parse real detections ---
    detections: List[Dict[str, Any]] = []
    if res.boxes is not None and len(res.boxes) > 0:
        for b in res.boxes:
            cls_idx = int(b.cls[0]) if hasattr(b.cls, "__getitem__") else int(b.cls)
            detections.append(
                {
                    "item_type": CLASSES[cls_idx] if 0 <= cls_idx < len(CLASSES) else f"class_{cls_idx}",
                    "confidence": float(b.conf[0]) if hasattr(b.conf, "__getitem__") else float(b.conf),
                    "box": [float(v) for v in b.xyxy[0]],
                }
            )

    return JSONResponse(
        {
            "detections": detections,
            "detection_count": len(detections),
            "model": "best.pt",
            "confidence_threshold": conf,
            "iou_threshold": iou,
        }
    )
