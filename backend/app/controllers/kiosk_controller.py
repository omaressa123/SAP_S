from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response, error_response
from ..utils.auth import verify_api_key
from ..database import get_db
from sqlalchemy.orm import Session
from ..models.identity import Passenger, TravelDocument
from datetime import datetime

router = APIRouter()

class ScanPassportRequest(BaseModel):
    kioskEquipmentId: int
    rawMrzCode: str
    scannedImageBase64: str

class EnrollFaceRequest(BaseModel):
    passengerId: int
    kioskEquipmentId: int
    capturedFaceBase64: str

@router.post("/passport/scan", dependencies=[Depends(verify_api_key)])
def scan_passport(payload: ScanPassportRequest):
    return success_response(data={
        "passportNumber": "A12345678",
        "fullName": "AHMED MOHAMED HASSAN",
        "nationalityCountryCode": "EG",
        "dateOfBirth": "1992-05-14",
        "matchingPassenger": {
            "passengerId": 501,
            "profileFound": True,
            "linkedBooking": {
                "bookingId": 2048,
                "flightNumber": "MS777"
            }
        }
    })

@router.post("/biometrics/enroll", dependencies=[Depends(verify_api_key)])
def enroll_biometrics(payload: EnrollFaceRequest):
    return success_response(data={
        "enrollmentStatus": "SUCCESS",
        "embeddingRef": "vec_p501_8f9a0b12",
        "faceQualityScore": 0.98,
        "matchWithPassportPhoto": True,
        "matchConfidence": 96.45,
        "sessionInitializedAt": "2026-08-24T08:15:00Z"
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

class RegisterPassengerRequest(BaseModel):
    full_name: str
    passport_number: str
    date_of_birth: str | None = None
    nationality: str | None = None
    gender: str | None = None
    expiry_date: str | None = None
    mrz_raw: str | None = None

@router.post("/register")
def register_passenger(payload: RegisterPassengerRequest, db: Session = Depends(get_db)):
    try:
        # Find or create passenger
        passenger = db.query(Passenger).join(TravelDocument).filter(
            TravelDocument.document_number == payload.passport_number
        ).first()

        dob = None
        if payload.date_of_birth:
            try:
                dob = datetime.strptime(payload.date_of_birth, "%Y-%m-%d").date()
            except ValueError:
                pass

        # Validate nationality against Country table to prevent FK violations
        from ..models.identity import Country
        nat_code = payload.nationality[:3].upper() if payload.nationality else None
        if nat_code:
            country_exists = db.query(Country).filter(Country.country_code == nat_code).first()
            if not country_exists:
                # Auto-generate the country so it doesn't default to null
                new_country = Country(country_code=nat_code, country_name="Auto-Generated", created_at=datetime.utcnow())
                db.add(new_country)
                db.commit()

        if not passenger:
            passenger = Passenger(
                full_name=payload.full_name,
                date_of_birth=dob,
                nationality_country_code=nat_code,
                gender=payload.gender,
                biometric_consent=True,
                consent_date=datetime.utcnow(),
                created_at=datetime.utcnow()
            )
            db.add(passenger)
            db.flush() # get passenger_id
            
            # Create TravelDocument
            expiry = None
            if payload.expiry_date:
                try:
                    expiry = datetime.strptime(payload.expiry_date, "%Y-%m-%d").date()
                except ValueError:
                    pass
                    
            doc = TravelDocument(
                passenger_id=passenger.passenger_id,
                document_type="P",
                document_number=payload.passport_number,
                issuing_country_code=nat_code,
                expiry_date=expiry,
                mrz_hash=payload.mrz_raw,
                is_primary=True,
                created_at=datetime.utcnow()
            )
            db.add(doc)
            db.commit()
            db.refresh(passenger)
            return success_response(data={"message": "Passenger registered successfully", "passenger_id": passenger.passenger_id})
        else:
            # If passenger exists, update their details just in case
            passenger.biometric_consent = True
            if not passenger.consent_date:
                passenger.consent_date = datetime.utcnow()
            
            if payload.gender and not passenger.gender:
                passenger.gender = payload.gender
            
            doc = db.query(TravelDocument).filter(TravelDocument.document_number == payload.passport_number).first()
            if doc and payload.mrz_raw:
                doc.mrz_hash = payload.mrz_raw
            db.commit()
        
        return success_response(data={"message": "Passenger already exists", "passenger_id": passenger.passenger_id})
    except Exception as e:
        db.rollback()
        return error_response(code="DB_ERROR", message=str(e), status_code=500)
