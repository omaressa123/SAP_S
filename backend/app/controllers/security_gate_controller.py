from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

class SecurityGateVerifyRequest(BaseModel):
    gateId: int
    capturedFrameBase64: str

@router.post("/verify", dependencies=[Depends(verify_api_key)])
def verify_security_gate(payload: SecurityGateVerifyRequest):
    return success_response(data={
        "gateLogId": 12004,
        "passengerId": 501,
        "passengerName": "AHMED MOHAMED HASSAN",
        "faceMatchResult": "pass",
        "matchConfidence": 0.89,
        "metalDetectionResult": "clear",
        "authorizationResult": "authorized",
        "gateOpened": True,
        "timestamp": "2026-08-24T08:40:00Z"
    })
