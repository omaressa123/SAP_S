from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from ..utils.response_envelope import success_response
from ..utils.auth import get_current_user
from ..database import get_db
from ..services.passenger_service import PassengerService
from ..models.identity import Passenger, TravelDocument
from ..models.flights import Notification, Flight, Booking
from ..models.wayfinding import Zone, MapNode, MapEdge

router = APIRouter()

@router.get("/all")
def get_all_passengers(db: Session = Depends(get_db)):
    passengers = db.query(Passenger).all()
    results = []
    for p in passengers:
        doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == p.passenger_id).first()
        results.append({
            "passengerId": p.passenger_id,
            "fullName": p.full_name,
            "email": p.email,
            "phone": p.phone,
            "nationality": p.nationality_country_code,
            "dateOfBirth": p.date_of_birth.isoformat() if p.date_of_birth else None,
            "passportNumber": doc.document_number if doc else None
        })
    return success_response(data=results)

class LinkBookingRequest(BaseModel):
    bookingReference: str
    passportNumber: str

@router.post("/bookings/link")
def link_booking(payload: LinkBookingRequest, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    passenger_id = user.get("linkedPersonId")
    result = PassengerService.link_booking(db, passenger_id, payload)
    return success_response(data=result)

@router.get("/flights/current")
def get_active_flight(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    passenger_id = user.get("linkedPersonId")
    result = PassengerService.get_active_flight(db, passenger_id)
    return success_response(data=result)

class NavRequestLocation(BaseModel):
    xCoord: float
    yCoord: float
    zoneId: int

class NavRequest(BaseModel):
    currentLocation: NavRequestLocation
    destinationType: str
    targetGateId: int

@router.post("/navigation/route", dependencies=[Depends(get_current_user)])
def get_navigation_route(payload: NavRequest, db: Session = Depends(get_db)):
    """Calculate wayfinding route using airport zones and map nodes from database."""
    zones = {z.zone_id: z.zone_name for z in db.query(Zone).all()}
    start_zone_name = zones.get(payload.currentLocation.zoneId, "Check-in Hall")

    # Read map nodes from database if available
    nodes = db.query(MapNode).filter(MapNode.zone_id == payload.currentLocation.zoneId).all()
    waypoints = []
    if nodes:
        for idx, n in enumerate(nodes[:5], start=1):
            waypoints.append({
                "step": idx,
                "zoneName": zones.get(n.zone_id, start_zone_name),
                "x": float(n.x_coord) if n.x_coord else 100.0 * idx,
                "y": float(n.y_coord) if n.y_coord else 50.0 * idx,
                "instruction": f"Follow path towards {n.label or 'checkpoint'}"
            })
    else:
        waypoints = [
            {"step": 1, "zoneName": start_zone_name, "x": payload.currentLocation.xCoord, "y": payload.currentLocation.yCoord, "instruction": f"Depart from {start_zone_name}"},
            {"step": 2, "zoneName": "Security Screening Alpha", "x": payload.currentLocation.xCoord + 60.0, "y": payload.currentLocation.yCoord + 20.0, "instruction": "Proceed through E-Gate scanner"},
            {"step": 3, "zoneName": f"Gate B{payload.targetGateId} Concourse", "x": payload.currentLocation.xCoord + 130.0, "y": payload.currentLocation.yCoord + 50.0, "instruction": f"Arrive at Gate B{payload.targetGateId}"}
        ]

    total_dist = 280.0 + (payload.targetGateId * 3.5)
    walk_mins = max(2, round(total_dist / 70.0))

    return success_response(data={
        "totalDistanceMeters": round(total_dist, 1),
        "estimatedWalkingTimeMinutes": walk_mins,
        "pathWaypoints": waypoints
    })

@router.get("/notifications", dependencies=[Depends(get_current_user)])
def fetch_notifications(passengerId: int = Query(...), limit: int = 10, db: Session = Depends(get_db)):
    """Retrieve actual passenger notifications stored in database."""
    notifs = db.query(Notification).filter(Notification.passenger_id == passengerId).order_by(Notification.notification_id.desc()).limit(limit).all()
    
    results = []
    for n in notifs:
        results.append({
            "notificationId": n.notification_id,
            "channel": n.channel or "push",
            "type": n.notification_type or "system",
            "title": n.notification_type.replace("_", " ").title() if n.notification_type else "Notification",
            "content": n.content,
            "relatedEntityType": n.related_entity_type,
            "relatedEntityId": n.related_entity_id,
            "createdAt": n.created_at.isoformat() + "Z" if n.created_at else None,
            "isRead": n.read_at is not None
        })

    return success_response(data=results)
