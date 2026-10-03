from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key, require_role

router = APIRouter()

class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int

class CctvDetectRequest(BaseModel):
    cameraId: int
    zoneId: int
    behaviorType: str
    severity: str
    detectedBoundingBox: BoundingBox
    unattendedDurationSeconds: int
    snapshotBase64: str

class EscalateAlertRequest(BaseModel):
    monitoringAlertId: int
    eventType: str
    zoneId: int

@router.post("/cctv/detect", dependencies=[Depends(verify_api_key)])
def cctv_anomaly_detect(payload: CctvDetectRequest):
    return success_response(data={
        "monitoringAlertId": 8802,
        "status": "open",
        "alertLevel": "high",
        "triggeredEmergencyEventId": None,
        "broadcastedToAocc": True
    }, status_code=201)

@router.post("/emergency/escalate", dependencies=[Depends(require_role(["security_officer", "admin"]))])
def escalate_alert(payload: EscalateAlertRequest):
    return success_response(data={
        "eventId": 901,
        "eventType": payload.eventType,
        "status": "in_progress",
        "assignedRobot": { "robotId": 7, "type": "emergency_response", "status": "busy" },
        "dispatchedAt": "2026-08-24T08:50:00Z"
    }, status_code=201)
