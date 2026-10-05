from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

from typing import Optional

class BoardingGateVerifyRequest(BaseModel):
    boardingGateId: Optional[int] = 22
    flightId: Optional[int] = 1
    capturedFrameBase64: Optional[str] = ""
    passengerId: Optional[int] = 1

@router.post("/verify-and-board", dependencies=[Depends(verify_api_key)])
def execute_boarding_verification(payload: BoardingGateVerifyRequest):
    return success_response(data={
        "boardingId": 3301,
        "passengerId": payload.passengerId or 1,
        "passengerName": "Alex Mercer",
        "passportNumber": "P982301A",
        "seatNumber": "14A",
        "group": "2",
        "gate": "B22",
        "flightNumber": "QR-082",
        "destination": "Doha (DOH)",
        "cabinClass": "BUSINESS CLASS",
        "departureTime": "10:45 AM",
        "aircraftStand": "Remote Bay 12",
        "faceMatchResult": "pass",
        "boardingStatus": "boarded",
        "gateTurnstileOpened": True,
        "barriersUnlocked": True,
        "timestamp": "2026-10-05T10:45:00Z"
    })
