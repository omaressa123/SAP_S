from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.check_in import Bag, BagCheckpointLog
from ..models.identity import Passenger
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

class BagCheckpointRequest(BaseModel):
    bagId: int
    checkpointType: str
    conveyorId: int = 1
    handlerRobotId: Optional[int] = None
    location: str
    elapsedTimeSec: Optional[int] = 0

@router.post("/checkpoint", dependencies=[Depends(verify_api_key)])
def record_bag_checkpoint(payload: BagCheckpointRequest, db: Session = Depends(get_db)):
    """Persist baggage checkpoint location scan to database."""
    now = datetime.utcnow()
    bag = db.query(Bag).filter(Bag.bag_id == payload.bagId).first()
    if bag:
        bag.current_location = payload.location
        bag.current_status = payload.checkpointType
        bag.updated_at = now

    log = BagCheckpointLog(
        bag_id=payload.bagId,
        checkpoint_type=payload.checkpointType,
        equipment_id=payload.conveyorId,
        location=payload.location,
        timestamp=now,
        created_at=now,
        updated_at=now
    )
    db.add(log)
    if bag:
        try:
            from ..services import journey_service as js
            journey = js.get_or_create_journey(db, passenger_id=bag.passenger_id, booking_id=bag.booking_id)
            cp_lower = (payload.checkpointType or "").lower().replace(" ", "_")
            if cp_lower in ("transferred_to_carousel", "ready_for_collection"):
                journey.baggage_carousel = payload.location
                js.record_touchpoint(db, journey=journey, stage="baggage_collection", status="in_progress", location=payload.location)
            elif cp_lower == "collected":
                js.record_touchpoint(db, journey=journey, stage="baggage_collection", status="completed", location=payload.location)
                js.record_touchpoint(db, journey=journey, stage="journey_completed", status="completed", location=payload.location)
            else:
                js.journey_ws_manager.broadcast_sync(journey.journey_id, {"type": "journey_update", "journey": js.build_journey_snapshot(db, journey)})
        except Exception:
            pass
    db.commit()
    db.refresh(log)

    return success_response(data={
        "checkpointLogId": log.checkpoint_log_id,
        "bagId": payload.bagId,
        "currentStatus": bag.current_status if bag else payload.checkpointType,
        "timestamp": now.isoformat() + "Z"
    }, status_code=201)

@router.get("/all")
def get_all_bags(db: Session = Depends(get_db)):
    bags = db.query(Bag).all()
    results = []
    for b in bags:
        p = db.query(Passenger).filter(Passenger.passenger_id == b.passenger_id).first()
        results.append({
            "bagId": b.bag_id,
            "passengerName": p.full_name if p else f"Passenger #{b.passenger_id}",
            "rfidTag": b.rfid_tag or f"RF-BAG-{b.bag_id}",
            "qrCode": b.qr_code or f"QR-BAG-{b.bag_id}",
            "weightKg": float(b.weight_kg) if b.weight_kg else 20.0,
            "currentStatus": b.current_status or "loaded",
            "currentLocation": b.current_location or "Conveyor Line"
        })
    return success_response(data=results)

@router.get("/history/{bagId}")
def get_luggage_history(bagId: int, db: Session = Depends(get_db)):
    bag = db.query(Bag).filter(Bag.bag_id == bagId).first()
    logs = db.query(BagCheckpointLog).filter(BagCheckpointLog.bag_id == bagId).order_by(BagCheckpointLog.timestamp.asc()).all()
    
    timeline = []
    for l in logs:
        timeline.append({
            "type": l.checkpoint_type,
            "location": l.location,
            "time": l.timestamp.isoformat() + "Z" if l.timestamp else None
        })

    return success_response(data={
        "bagId": bagId,
        "rfidTag": bag.rfid_tag if bag else f"RF-BAG-{bagId}",
        "currentStatus": bag.current_status if bag else "unknown",
        "currentLocation": bag.current_location if bag else "Awaiting Check-in",
        "weightKg": float(bag.weight_kg) if (bag and bag.weight_kg) else 0.0,
        "timeline": timeline
    })
