from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

class BoardingGateVerifyRequest(BaseModel):
    boardingGateId: int
    flightId: int
    capturedFrameBase64: str

@router.post("/verify-and-board", dependencies=[Depends(verify_api_key)])
def execute_boarding_verification(payload: BoardingGateVerifyRequest):
    return success_response(data={
        "boardingId": 3301,
        "passengerId": 501,
        "seatNumber": "12A",
        "flightNumber": "MS777",
        "faceMatchResult": "pass",
        "boardingStatus": "boarded",
        "gateTurnstileOpened": True,
        "timestamp": "2026-08-24T10:05:00Z"
    })
