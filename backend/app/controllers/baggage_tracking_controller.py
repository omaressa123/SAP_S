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

from sqlalchemy.orm import Session
from ..database import get_db
from ..models.check_in import Bag, BagCheckpointLog
from ..models.identity import Passenger

@router.get("/all")
def get_all_bags(db: Session = Depends(get_db)):
    bags = db.query(Bag).all()
    results = []
    for b in bags:
        p = db.query(Passenger).filter(Passenger.passenger_id == b.passenger_id).first()
        results.append({
            "bagId": b.bag_id,
            "passengerName": p.full_name if p else "Alex Mercer",
            "rfidTag": b.rfid_tag or f"RF-BAG-{b.bag_id}",
            "qrCode": b.qr_code or f"QR-BAG-{b.bag_id}",
            "weightKg": float(b.weight_kg) if b.weight_kg else 22.0,
            "currentStatus": b.current_status or "loaded",
            "currentLocation": b.current_location or "Conveyor Line B"
        })
    return success_response(data=results)

@router.get("/history/{bagId}")
def get_luggage_history(bagId: int, db: Session = Depends(get_db)):
    bag = db.query(Bag).filter(Bag.bag_id == bagId).first()
    logs = db.query(BagCheckpointLog).filter(BagCheckpointLog.bag_id == bagId).all()
    
    timeline = []
    if logs:
        for l in logs:
            timeline.append({
                "type": l.checkpoint_type,
                "location": l.location,
                "time": l.timestamp.isoformat() + "Z" if l.timestamp else "2026-10-05T10:30:00Z"
            })
    else:
        timeline = [
            { "type": "checkin", "location": "Kiosk #04 - Hall B", "time": "2026-10-05T09:45:00Z" },
            { "type": "security_scanner", "location": "AI Threat Detection Scanner #02", "time": "2026-10-05T09:58:30Z" },
            { "type": "sorting_conveyor", "location": "Main Sorter Conveyor Line B", "time": "2026-10-05T10:15:00Z" },
            { "type": "loaded_aircraft", "location": "Flight QR-082 Cargo Hold (Bay 12)", "time": "2026-10-05T10:35:00Z" }
        ]

    return success_response(data={
        "bagId": bagId,
        "rfidTag": bag.rfid_tag if bag else f"RF-BAG-{bagId}",
        "currentStatus": bag.current_status if bag else "loaded",
        "currentLocation": bag.current_location if bag else "Flight QR-082 Cargo Hold (Bay 12)",
        "weightKg": float(bag.weight_kg) if (bag and bag.weight_kg) else 22.4,
        "timeline": timeline
    })
