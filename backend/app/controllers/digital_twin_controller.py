from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key, require_role

router = APIRouter()

class PositionPushRequest(BaseModel):
    entityType: str
    entityId: int
    xCoord: float
    yCoord: float
    zCoord: float

@router.post("/position", dependencies=[Depends(verify_api_key)])
def push_3d_position(payload: PositionPushRequest):
    return success_response(data={
        "positionId": 550012,
        "status": "RECORDED"
    })

@router.get("/dashboard/live", dependencies=[Depends(require_role(["admin", "aocc_staff"]))])
def live_dashboard_overview():
    return success_response(data={
        "timestamp": "2026-08-24T09:00:00Z",
        "passengerCount": 1420,
        "activeBagsCount": 850,
        "robotsOnline": 12,
        "openAlertsCount": 3,
        "openMaintenanceTickets": 2,
        "zonesOccupancy": [
            { "zoneId": 1, "zoneName": "Check-in Hall", "currentOccupancy": 450, "capacity": 1000 },
            { "zoneId": 3, "zoneName": "Security Area", "currentOccupancy": 210, "capacity": 300 }
        ]
    })
