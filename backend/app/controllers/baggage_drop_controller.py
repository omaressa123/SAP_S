from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

class WeighBagRequest(BaseModel):
    checkinId: int
    bookingId: int
    passengerId: int
    rfidTag: str
    qrCode: str
    weightKg: float
    lengthCm: float
    widthCm: float
    heightCm: float

@router.post("/weigh", dependencies=[Depends(verify_api_key)])
def process_bag_weighing(payload: WeighBagRequest):
    return success_response(data={
        "bagId": 901,
        "weightStatus": "ACCEPTED",
        "dimensionStatus": "ACCEPTED",
        "excessChargeAmount": 0.00,
        "currentStatus": "moving",
        "currentLocation": "Conveyor Belt Line 1"
    })
