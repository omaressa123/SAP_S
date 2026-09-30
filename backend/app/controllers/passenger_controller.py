from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import get_current_user
from ..database import get_db
from ..services.passenger_service import PassengerService
from ..models.identity import Passenger, TravelDocument

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
def get_navigation_route(payload: NavRequest):
    return success_response(data={
        "totalDistanceMeters": 350.5,
        "estimatedWalkingTimeMinutes": 5,
        "pathWaypoints": [
            { "step": 1, "zoneName": "Main Hall", "x": 120.45, "y": 45.10, "instruction": "Head straight towards Security Check" },
            { "step": 2, "zoneName": "Security Gate B", "x": 180.00, "y": 60.00, "instruction": "Proceed through E-Gate" },
            { "step": 3, "zoneName": "Duty Free Concourse", "x": 250.20, "y": 90.50, "instruction": "Turn left towards Gate B12" }
        ]
    })

@router.get("/notifications", dependencies=[Depends(get_current_user)])
def fetch_notifications(passengerId: int = Query(...), limit: int = 10):
    return success_response(data=[
        {
            "notificationId": 9801,
            "channel": "push",
            "type": "boarding_call",
            "title": "Boarding Started",
            "content": "Flight MS777 is now boarding at Gate B12. Please proceed immediately.",
            "relatedEntityType": "Flight",
            "relatedEntityId": 88,
            "createdAt": "2026-08-24T09:45:00Z",
            "isRead": False
        }
    ])
