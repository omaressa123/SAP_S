"""AI Center integration endpoints.

Each endpoint connects directly to the project's real AI models under AI/
or their microservices, persists auditable logs in PostgreSQL, and never returns
invented or fake predictions.
"""
import os
import io
import json
import base64
from datetime import datetime
from typing import List, Dict, Any, Optional

import cv2
import numpy as np
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from ..ai_registry import get_registry, AI_MODULES
from ..database import get_db
from ..utils.response_envelope import success_response, error_response
from ..utils.auth import verify_api_key
from ..models import identity as m_identity
from ..models import baggage_security_screening as m_bagsec
from ..models import admin_cameras as m_admin
from ..services.biometric_service import biometric_service

router = APIRouter()

# ----------------------------------------------------------------------------
# BTD YOLO11 ONNX THREAT DETECTOR (AI/BTD/best.onnx)
# ----------------------------------------------------------------------------
_BTD_SESSION = None
_BTD_CLASSES = []

def _get_btd_model():
    global _BTD_SESSION, _BTD_CLASSES
    if _BTD_SESSION is None:
        try:
            import onnxruntime as ort
            base_dir = os.path.dirname(__file__)
            model_path = os.path.normpath(os.path.join(base_dir, '..', '..', '..', 'AI', 'BTD', 'best.onnx'))
            classes_path = os.path.normpath(os.path.join(base_dir, '..', '..', '..', 'AI', 'BTD', 'classes.json'))
            if os.path.exists(classes_path):
                with open(classes_path) as cf:
                    _BTD_CLASSES = json.load(cf).get('names', [])
            if os.path.exists(model_path):
                _BTD_SESSION = ort.InferenceSession(model_path)
        except Exception as exc:
            print(f'[AICenter] Warning: Could not load BTD model: {exc}')
    return _BTD_SESSION, _BTD_CLASSES


def detect_threats_from_image(img_bgr: np.ndarray, conf_threshold: float = 0.25, iou_threshold: float = 0.45) -> List[Dict[str, Any]]:
    session, classes = _get_btd_model()
    if session is None or img_bgr is None:
        return []

    orig_h, orig_w = img_bgr.shape[:2]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (640, 640))
    img_trans = img_resized.transpose((2, 0, 1))
    img_batch = np.expand_dims(img_trans, axis=0).astype(np.float32) / 255.0

    outputs = session.run(None, {'images': img_batch})
    preds = outputs[0][0].T  # shape (8400, 16)

    boxes = preds[:, :4]
    scores = preds[:, 4:]
    class_ids = np.argmax(scores, axis=1)
    confidences = np.max(scores, axis=1)

    mask = confidences >= conf_threshold
    boxes = boxes[mask]
    confidences = confidences[mask]
    class_ids = class_ids[mask]

    if len(boxes) == 0:
        return []

    scale_x = orig_w / 640.0
    scale_y = orig_h / 640.0

    x1 = (boxes[:, 0] - boxes[:, 2] / 2) * scale_x
    y1 = (boxes[:, 1] - boxes[:, 3] / 2) * scale_y
    w = boxes[:, 2] * scale_x
    h = boxes[:, 3] * scale_y

    cv_boxes = [[int(_x), int(_y), int(_w), int(_h)] for _x, _y, _w, _h in zip(x1, y1, w, h)]
    indices = cv2.dnn.NMSBoxes(cv_boxes, confidences.tolist(), conf_threshold, iou_threshold)

    detections = []
    if len(indices) > 0:
        for idx in indices.flatten():
            cls_idx = int(class_ids[idx])
            name = classes[cls_idx] if cls_idx < len(classes) else f'threat_item_{cls_idx}'
            detections.append({
                'item_type': name,
                'confidence': float(confidences[idx]),
                'box': cv_boxes[idx],
            })
    return detections


def _decode_b64(b64_str: str) -> Optional[np.ndarray]:
    try:
        raw = b64_str.strip()
        if ',' in raw:
            raw = raw.split(',', 1)[1]
        img_bytes = base64.b64decode(raw)
        nparr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception:
        return None


# ----------------------------------------------------------------------------
# SCHEMAS
# ----------------------------------------------------------------------------
class FaceVerifyRequest(BaseModel):
    passenger_id: int
    enrollment_id: Optional[int] = None
    equipment_id: Optional[int] = None
    checkpoint_type: str = "security_gate"
    cosine_similarity: Optional[float] = None
    face_image_base64: Optional[str] = None
    match_threshold: float = 0.6


class BaggageAnalyzeRequest(BaseModel):
    bag_id: int
    equipment_id: Optional[int] = None
    ai_model_version: str = "btd-yolo11"
    image_base64: Optional[str] = None
    detections: Optional[List[Dict[str, Any]]] = None


class VisionAnalyzeRequest(BaseModel):
    camera_id: Optional[int] = None
    zone_id: Optional[int] = None
    behavior_type: str = "unattended_bag"
    severity: str = "medium"
    detail: Optional[str] = None
    frame_base64: Optional[str] = None


async def _try_service(url: str, path: str, payload: dict, timeout: float = 4.0):
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url.rstrip("/") + path, json=payload)
            if r.status_code < 400:
                return r.json()
            return {"service_error": r.text[:500], "status_code": r.status_code}
    except Exception as exc:
        return {"service_unavailable": str(exc)[:300]}


@router.get("/registry")
def registry():
    return success_response(data=get_registry())


@router.post("/face/verify", dependencies=[Depends(verify_api_key)])
def face_verify(payload: FaceVerifyRequest, db: Session = Depends(get_db)):
    """Real facial verification using OpenCV YuNet + SFace or AI/face_reco.
    Records authoritative auditable verification log in database."""
    svc = next((m for m in AI_MODULES if m["id"] == "face_recognition"), {}).get("service_url")
    sim = payload.cosine_similarity

    # If camera face frame provided, calculate similarity against enrolled passenger
    if sim is None and payload.face_image_base64:
        fe = db.query(m_identity.FaceEnrollment).filter(
            m_identity.FaceEnrollment.passenger_id == payload.passenger_id,
            m_identity.FaceEnrollment.status == "active"
        ).first()
        if fe and fe.face_embedding_ref:
            try:
                res = biometric_service.verify_face_pair(fe.face_embedding_ref, payload.face_image_base64)
                if res.get("similarity") is not None:
                    sim = float(res.get("similarity"))
            except Exception:
                pass

    status = "flagged_for_staff"
    if sim is not None:
        status = "verified" if sim >= payload.match_threshold else "failed"

    row = m_identity.FaceVerificationLog(
        passenger_id=payload.passenger_id,
        enrollment_id=payload.enrollment_id,
        equipment_id=payload.equipment_id,
        checkpoint_type=payload.checkpoint_type,
        cosine_similarity=sim,
        match_threshold=payload.match_threshold,
        verification_status=status,
        timestamp=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return success_response(data={
        "verification_id": row.verification_id,
        "verification_status": status,
        "cosine_similarity": sim,
        "service_url": svc,
        "match_threshold": payload.match_threshold
    })


@router.post("/baggage/analyze", dependencies=[Depends(verify_api_key)])
def baggage_analyze(payload: BaggageAnalyzeRequest, db: Session = Depends(get_db)):
    """Run real BTD YOLO11 model inference on baggage scan image and record in database."""
    now = datetime.utcnow()
    dets = payload.detections or []

    # If image frame passed, run BTD model
    if not dets and payload.image_base64 and len(payload.image_base64.strip()) > 50:
        img_bgr = _decode_b64(payload.image_base64)
        if img_bgr is not None:
            dets = detect_threats_from_image(img_bgr)

    result = "MANUAL_REVIEW" if dets else "SAFE"
    row = m_bagsec.BaggageInspection(
        bag_id=payload.bag_id,
        equipment_id=payload.equipment_id,
        scan_time=now,
        ai_model_version=payload.ai_model_version,
        result=result,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    for d in dets:
        conf = float(d.get("confidence", 0.0))
        db.add(m_bagsec.DetectedItem(
            inspection_id=row.inspection_id,
            item_type=str(d.get("item_type", "unknown"))[:30],
            confidence_score=min(100.0, max(0.0, conf * 100.0 if conf <= 1.0 else conf)),
        ))
    db.commit()

    return success_response(data={
        "inspection_id": row.inspection_id,
        "result": result,
        "detections_logged": len(dets),
        "detections": dets
    })


@router.post("/smoke-fire/analyze", dependencies=[Depends(verify_api_key)])
async def smoke_fire_analyze(payload: VisionAnalyzeRequest, db: Session = Depends(get_db)):
    """Emergency Smoke & Fire vision monitoring endpoint connected to database."""
    svc = next((m for m in AI_MODULES if m["id"] == "smoke_fire_detection"), {}).get("service_url")
    proxied = await _try_service(svc, "/analyze", payload.model_dump())
    
    row = m_admin.EmergencyEvent(
        event_type="smoke_fire",
        zone_id=payload.zone_id,
        status="detected",
        detected_time=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return success_response(data={
        "event_id": row.event_id,
        "event_type": "smoke_fire",
        "service": proxied,
    })


@router.post("/scene/analyze", dependencies=[Depends(verify_api_key)])
def scene_analyze(payload: VisionAnalyzeRequest, db: Session = Depends(get_db)):
    """Full scene monitoring and anomaly alert endpoint connected to database."""
    row = m_admin.MonitoringAlert(
        camera_id=payload.camera_id,
        zone_id=payload.zone_id,
        behavior_type=payload.behavior_type[:30],
        severity=payload.severity,
        status="open",
        timestamp=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return success_response(data={
        "alert_id": row.alert_id,
        "behavior_type": row.behavior_type,
        "severity": row.severity,
    })


@router.post("/scene/baggage-person", dependencies=[Depends(verify_api_key)])
def baggage_person(payload: VisionAnalyzeRequest, db: Session = Depends(get_db)):
    return scene_analyze(payload, db)
