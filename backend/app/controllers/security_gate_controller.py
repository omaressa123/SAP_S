from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

from typing import Optional

class SecurityGateVerifyRequest(BaseModel):
    gateId: Optional[int] = 22
    capturedFrameBase64: Optional[str] = ""
    passengerId: Optional[int] = 1

@router.post("/verify", dependencies=[Depends(verify_api_key)])
def verify_security_gate(payload: SecurityGateVerifyRequest):
    return success_response(data={
        "gateLogId": 12004,
        "passengerId": payload.passengerId or 1,
        "passengerName": "Alex Mercer",
        "passportNumber": "P982301A",
        "flightNumber": "QR-082",
        "gate": "B22",
        "group": "2",
        "seatNumber": "14A",
        "destination": "Doha (DOH)",
        "cabinClass": "BUSINESS CLASS",
        "departureTime": "10:45 AM",
        "aircraftStand": "Remote Bay 12",
        "faceMatchResult": "pass",
        "matchConfidence": 0.994,
        "metalDetectionResult": "clear",
        "authorizationResult": "authorized",
        "gateOpened": True,
        "barriersUnlocked": True,
        "timestamp": "2026-10-05T10:45:00Z"
    })
