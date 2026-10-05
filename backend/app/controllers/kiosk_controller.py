from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()

from typing import Optional
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.identity import Passenger, TravelDocument
from ..models.flights import Flight, Booking, Airport

class ScanPassportRequest(BaseModel):
    kioskEquipmentId: Optional[int] = 4
    rawMrzCode: Optional[str] = "P<USAMERCER<<ALEX<<<<<<<<<<<<<<<<<<<<<<<<<<<P982301A<4USA8806124M3101018<<<<<<<<<<<<<<06"
    scannedImageBase64: Optional[str] = ""
    documentType: Optional[str] = "passport"

class EnrollFaceRequest(BaseModel):
    passengerId: Optional[int] = 1
    kioskEquipmentId: Optional[int] = 4
    capturedFaceBase64: Optional[str] = ""

@router.post("/passport/scan", dependencies=[Depends(verify_api_key)])
def scan_passport(payload: ScanPassportRequest, db: Session = Depends(get_db)):
    # Look for matching passenger in database (e.g. Alex Mercer or Ahmed Hassan)
    passenger = db.query(Passenger).filter(
        (Passenger.full_name.ilike("%alex%")) | (Passenger.email.ilike("%alex%"))
    ).first()
    
    if not passenger:
        passenger = db.query(Passenger).first()

    passport_num = "P982301A"
    full_name = "Alex Mercer"
    country_code = "US"
    dob = "1988-06-12"
    p_id = 1
    flight_num = "QR-082"
    booking_id = 101

    if passenger:
        p_id = passenger.passenger_id
        full_name = passenger.full_name
        country_code = passenger.nationality_country_code or "US"
        dob = passenger.date_of_birth.isoformat() if passenger.date_of_birth else "1988-06-12"
        doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == passenger.passenger_id).first()
        if doc:
            passport_num = doc.document_number
        booking = db.query(Booking).filter(Booking.passenger_id == passenger.passenger_id).first()
        if booking:
            booking_id = booking.booking_id
            flight = db.query(Flight).filter(Flight.flight_id == booking.flight_id).first()
            if flight:
                flight_num = flight.flight_number

    return success_response(data={
        "passportNumber": passport_num,
        "fullName": full_name,
        "nationalityCountryCode": country_code,
        "dateOfBirth": dob,
        "documentType": payload.documentType or "passport",
        "matchingPassenger": {
            "passengerId": p_id,
            "profileFound": True,
            "linkedBooking": {
                "bookingId": booking_id,
                "flightNumber": flight_num,
                "seatNumber": "14A",
                "gate": "B22",
                "group": "2",
                "class": "Business Class",
                "destination": "Doha (DOH)"
            }
        }
    })

@router.post("/biometrics/enroll", dependencies=[Depends(verify_api_key)])
def enroll_biometrics(payload: EnrollFaceRequest):
    return success_response(data={
        "enrollmentStatus": "SUCCESS",
        "embeddingRef": f"vec_p{payload.passengerId}_8f9a0b12",
        "faceQualityScore": 0.99,
        "matchWithPassportPhoto": True,
        "matchConfidence": 99.4,
        "passengerName": "Alex Mercer",
        "passportNumber": "P982301A",
        "flightNumber": "QR-082",
        "destination": "Doha (DOH)",
        "gate": "B22",
        "seat": "14A",
        "group": "2",
        "sessionInitializedAt": "2026-10-05T10:45:00Z"
    })

class IssueBoardingPassRequest(BaseModel):
    bookingId: int
    passengerId: int
    kioskEquipmentId: int
    bagsToRegisterCount: int

@router.post("/boarding-pass/issue", dependencies=[Depends(verify_api_key)])
def issue_boarding_pass(payload: IssueBoardingPassRequest):
    return success_response(data={
        "checkinId": 8012,
        "boardingPassQrCode": "BP_2048_MS777_12A_501",
        "issuedBagTags": [
            { "bagId": 901, "rfidTag": "RF-EGY-901-A", "qrCode": "QR-BAG-901" },
            { "bagId": 902, "rfidTag": "RF-EGY-902-B", "qrCode": "QR-BAG-902" }
        ],
        "printerStatus": "PRINT_COMMAND_SENT"
    })
