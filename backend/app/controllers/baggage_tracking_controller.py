from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key, get_current_user

router = APIRouter()

class BagCheckpointRequest(BaseModel):
    bagId: int
    checkpointType: str
    conveyorId: int
    handlerRobotId: Optional[int] = None
    location: str
    elapsedTimeSec: int

@router.post("/checkpoint", dependencies=[Depends(verify_api_key)])
def record_bag_checkpoint(payload: BagCheckpointRequest):
    return success_response(data={
        "checkpointLogId": 75001,
        "bagId": payload.bagId,
        "currentStatus": "moving",
        "timestamp": "2026-08-24T08:27:00Z"
    }, status_code=201)

@router.get("/history/{bagId}", dependencies=[Depends(get_current_user)])
def get_luggage_history(bagId: int):
    return success_response(data={
        "bagId": bagId,
        "currentStatus": "moving",
        "currentLocation": "Conveyor Line B - Zone 2",
        "timeline": [
            { "type": "checkin", "location": "Kiosk #45", "time": "2026-08-24T08:18:00Z" },
            { "type": "scanner", "location": "X-Ray Scanner #14", "time": "2026-08-24T08:22:10Z" },
            { "type": "conveyor", "location": "Conveyor Line B - Zone 2", "time": "2026-08-24T08:27:00Z" }
        ]
    })
