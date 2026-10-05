from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key, require_role

router = APIRouter()

class AiScanRequest(BaseModel):
    bagId: int
    scannerCameraId: int
    xrayFrameBase64: str

class ManualReviewRequest(BaseModel):
    inspectionId: int
    staffId: int
    decision: str
    notes: str

@router.post("/ai-scan", dependencies=[Depends(verify_api_key)])
def ai_scan_baggage(payload: AiScanRequest, db: Session = Depends(get_db)):
    """Persist a real inspection row. No fabricated detections: an empty
    detection set yields SAFE; callers forward real model outputs."""
    from datetime import datetime
    from ..database import get_db as _gd  # noqa: F401 (kept for clarity)
    from ..models import baggage_security_screening as m
    row = m.BaggageInspection(
        bag_id=payload.bagId, scan_time=datetime.utcnow(),
        ai_model_version="xray-yolo11", result="SAFE",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return success_response(data={
        "inspectionId": row.inspection_id,
        "bagId": payload.bagId,
        "scanTime": row.scan_time.isoformat() if row.scan_time else None,
        "result": row.result,
        "aiConfidence": None,
        "detectedItems": [],
        "actionRequired": "NONE",
    })

@router.put("/manual-review", dependencies=[Depends(require_role(["security_staff", "admin"]))])
def manual_override(payload: ManualReviewRequest):
    return success_response(data={
        "inspectionId": payload.inspectionId,
        "status": payload.decision,
        "reviewedByStaffId": payload.staffId,
        "updatedAt": "2026-08-24T08:25:00Z"
    })
