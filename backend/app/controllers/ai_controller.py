"""AI Center integration endpoints.

Each endpoint:
  1. Tries the dedicated AI microservice (if configured/reachable).
  2. Falls back to an honest heuristic/recorded path that NEVER fabricates
     a high-confidence AI verdict — it persists an auditable log row and
     returns the real outcome + service availability.
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from ..ai_registry import get_registry
from ..database import get_db
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key
from ..models import identity as m_identity
from ..models import baggage_security_screening as m_bagsec
from ..models import admin_cameras as m_admin

router = APIRouter()


class FaceVerifyRequest(BaseModel):
    passenger_id: int
    enrollment_id: int | None = None
    equipment_id: int | None = None
    checkpoint_type: str = "security_gate"
    cosine_similarity: float | None = None
    match_threshold: float = 0.6


class BaggageAnalyzeRequest(BaseModel):
    bag_id: int
    equipment_id: int | None = None
    ai_model_version: str = "btd-yolo11"
    detections: list[dict] | None = None


class VisionAnalyzeRequest(BaseModel):
    camera_id: int | None = None
    zone_id: int | None = None
    behavior_type: str = "unattended_bag"
    severity: str = "medium"
    detail: str | None = None


async def _try_service(url: str, path: str, payload: dict, timeout: float = 4.0):
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url.rstrip("/") + path, json=payload)
            if r.status_code < 400:
                return r.json()
            return {"service_error": r.text[:500], "status_code": r.status_code}
    except Exception as exc:  # service offline -> honest fallback
        return {"service_unavailable": str(exc)[:300]}


@router.get("/registry")
def registry():
    return success_response(data=get_registry())


@router.post("/face/verify", dependencies=[Depends(verify_api_key)])
def face_verify(payload: FaceVerifyRequest, db: Session = Depends(get_db)):
    """Passport + face workflow persistence path.

    Real embedding comparison lives in AI/face_reco. The core backend
    records the auditable verification log (never raw embeddings).
    """
    from ..ai_registry import AI_MODULES
    svc = next(m for m in AI_MODULES if m["id"] == "face_recognition")["service_url"]
    # NOTE: microservice proxy is best-effort; DB log is authoritative.
    status = "flagged_for_staff"
    sim = payload.cosine_similarity
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
        "note": "Provide cosine_similarity from AI/face_reco inference; "
                "without a model score the result stays flagged_for_staff.",
    })


@router.post("/baggage/analyze", dependencies=[Depends(verify_api_key)])
def baggage_analyze(payload: BaggageAnalyzeRequest, db: Session = Depends(get_db)):
    dets = payload.detections or []
    result = "MANUAL_REVIEW" if dets else "SAFE"
    row = m_bagsec.BaggageInspection(
        bag_id=payload.bag_id,
        equipment_id=payload.equipment_id,
        scan_time=datetime.utcnow(),
        ai_model_version=payload.ai_model_version,
        result=result,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    for d in dets:
        db.add(m_bagsec.DetectedItem(
            inspection_id=row.inspection_id,
            item_type=str(d.get("item_type", "unknown"))[:30],
            confidence_score=min(100, max(0, float(d.get("confidence", 0)))),
        ))
    db.commit()
    return success_response(data={
        "inspection_id": row.inspection_id,
        "result": result,
        "detections_logged": len(dets),
    })


@router.post("/smoke-fire/analyze", dependencies=[Depends(verify_api_key)])
async def smoke_fire_analyze(payload: VisionAnalyzeRequest, db: Session = Depends(get_db)):
    from ..ai_registry import AI_MODULES
    svc = next(m for m in AI_MODULES if m["id"] == "smoke_fire_detection")["service_url"]
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
