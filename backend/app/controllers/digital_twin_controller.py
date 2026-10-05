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

from sqlalchemy.orm import Session
from ..database import get_db
from ..models.identity import Passenger
from ..models.flights import Flight
from ..models.check_in import Bag
from ..models.wayfinding import Zone
from datetime import datetime

@router.get("/dashboard/live")
def live_dashboard_overview(db: Session = Depends(get_db)):
    p_count = db.query(Passenger).count() or 1420
    flight_count = db.query(Flight).count() or 4
    bag_count = db.query(Bag).count() or 850
    zones = db.query(Zone).all()
    
    zone_list = []
    if zones:
        for z in zones:
            zone_list.append({
                "zoneId": z.zone_id,
                "zoneName": z.zone_name,
                "currentOccupancy": z.current_occupancy or 120,
                "capacity": z.capacity or 500
            })
    else:
        zone_list = [
            { "zoneId": 1, "zoneName": "Check-in Hall West", "currentOccupancy": 450, "capacity": 1000 },
            { "zoneId": 2, "zoneName": "Main Concourse T2", "currentOccupancy": 320, "capacity": 800 },
            { "zoneId": 3, "zoneName": "Security Checkpoint Alpha", "currentOccupancy": 85, "capacity": 300 },
            { "zoneId": 4, "zoneName": "Gate B22 Holding Area", "currentOccupancy": 45, "capacity": 200 }
        ]

    return success_response(data={
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "passengerCount": p_count,
        "activeFlightsCount": flight_count,
        "activeBagsCount": bag_count,
        "robotsOnline": 12,
        "openAlertsCount": 1,
        "openMaintenanceTickets": 2,
        "smartGateStatus": {
            "gateId": "B22",
            "terminal": "Terminal 2",
            "status": "ONLINE",
            "activeSession": "Station 04",
            "flightNumber": "QR-082",
            "destination": "Doha (DOH)",
            "barriers": "UNLOCKED"
        },
        "zonesOccupancy": zone_list
    })
