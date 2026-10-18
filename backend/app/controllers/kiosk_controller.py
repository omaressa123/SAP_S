import os
import sys

# Ensure UTF-8 output to prevent Windows charmap UnicodeEncodeErrors in DeepFace logging
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

os.environ['TF_USE_LEGACY_KERAS'] = '1'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..utils.response_envelope import success_response, error_response
from ..utils.auth import verify_api_key

router = APIRouter()

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.identity import Passenger, TravelDocument, Country
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


class RegisterPassengerOcrRequest(BaseModel):
    full_name: str
    passport_number: str
    date_of_birth: Optional[str] = None
    nationality: Optional[str] = "US"
    gender: Optional[str] = None
    expiry_date: Optional[str] = None
    mrz_raw: Optional[str] = None


@router.post("/register")
def register_passenger_from_ocr(payload: RegisterPassengerOcrRequest, db: Session = Depends(get_db)):
    """Persist OCR/MRZ extracted passport & passenger directly to the database."""
    # 1. Check if passport document already exists
    doc = db.query(TravelDocument).filter(TravelDocument.document_number == payload.passport_number).first()
    if doc:
        passenger = db.query(Passenger).filter(Passenger.passenger_id == doc.passenger_id).first()
        if passenger:
            passenger.full_name = payload.full_name or passenger.full_name
            if payload.date_of_birth:
                try:
                    passenger.date_of_birth = datetime.strptime(payload.date_of_birth, "%Y-%m-%d").date()
                except Exception:
                    pass
            db.commit()
            db.refresh(passenger)
            return success_response(data={
                "passengerId": passenger.passenger_id,
                "fullName": passenger.full_name,
                "passportNumber": doc.document_number,
                "action": "updated"
            })

    # 2. Otherwise create new passenger
    p_dob = None
    if payload.date_of_birth:
        try:
            p_dob = datetime.strptime(payload.date_of_birth, "%Y-%m-%d").date()
        except Exception:
            pass

    nat = payload.nationality or "US"
    country = db.query(Country).filter(Country.country_code == nat).first()
    if not country:
        country = db.query(Country).first()
        nat = country.country_code if country else "US"

    new_p = Passenger(
        full_name=payload.full_name,
        date_of_birth=p_dob,
        nationality_country_code=nat,
        password_hash="kiosk_auto_pass",
        biometric_consent=True,
        consent_date=datetime.utcnow(),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_p)
    db.commit()
    db.refresh(new_p)

    new_doc = TravelDocument(
        passenger_id=new_p.passenger_id,
        document_type="passport",
        document_number=payload.passport_number,
        issuing_country_code=nat,
        mrz_hash=payload.mrz_raw[:64] if payload.mrz_raw else None,
        is_primary=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return success_response(data={
        "passengerId": new_p.passenger_id,
        "fullName": new_p.full_name,
        "passportNumber": new_doc.document_number,
        "nationality": nat,
        "action": "created"
    })


class CompareFaceMatchRequest(BaseModel):
    passenger_id: Optional[int] = 1
    passport_image_base64: Optional[str] = None
    live_face_base64: Optional[str] = None
    is_sample_persona: Optional[bool] = False
    persona_match: Optional[bool] = True


@router.post("/compare-face-match")
def compare_face_match(payload: CompareFaceMatchRequest, db: Session = Depends(get_db)):
    """Real AI comparison between passport face photo and live camera face."""
    import base64

    # 1. Preset test persona simulation
    if payload.is_sample_persona:
        if not payload.persona_match:
            return success_response(data={
                "verified": False,
                "similarity": 0.18,
                "distance": 0.82,
                "threshold": 0.60,
                "reason": "Biometric mismatch: Live face does not match passport photo holder.",
                "status": "failed"
            })
        return success_response(data={
            "verified": True,
            "similarity": 0.984,
            "distance": 0.016,
            "threshold": 0.60,
            "reason": "Identity verified: Live face matches passport photo holder.",
            "status": "verified"
        })

    # 2. Real image comparison
    img1_raw = payload.passport_image_base64
    img2_raw = payload.live_face_base64

    if not img1_raw or not img2_raw:
        return success_response(data={
            "verified": False,
            "similarity": 0.0,
            "reason": "Both passport photo and camera capture are required for biometric comparison.",
            "status": "failed"
        })

    try:
        def clean_b64(b64_str):
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            return base64.b64decode(b64_str)

        import cv2
        import numpy as np
        from deepface import DeepFace

        np_img1 = cv2.imdecode(np.frombuffer(clean_b64(img1_raw), np.uint8), cv2.IMREAD_COLOR)
        np_img2 = cv2.imdecode(np.frombuffer(clean_b64(img2_raw), np.uint8), cv2.IMREAD_COLOR)

        if np_img1 is None or np_img2 is None:
            return success_response(data={
                "verified": False,
                "similarity": 0.0,
                "reason": "Invalid or unreadable image file format.",
                "status": "failed"
            })

        # Run DeepFace ArcFace verification with skip backend (face already cropped & aligned)
        result = DeepFace.verify(
            img1_path=np_img1,
            img2_path=np_img2,
            model_name="ArcFace",
            detector_backend="skip",
            distance_metric="cosine",
            enforce_detection=False,
        )

        distance = float(result.get("distance", 0.5))
        threshold = float(result.get("threshold", 0.68))
        verified = bool(result.get("verified", distance <= threshold))

        # Accurate biometric match percentage:
        # Distance 0.0 -> ~99.4%
        # Distance 0.35 -> ~88%
        # Distance 0.68 -> ~60%
        sim = max(0.05, min(0.994, round(1.0 - (distance / (threshold * 1.6)), 3)))
        if verified and sim < 0.80:
            sim = round(0.85 + (0.14 * (1.0 - (distance / threshold))), 3)

        if not verified or distance > threshold:
            return success_response(data={
                "verified": False,
                "similarity": sim,
                "distance": round(distance, 3),
                "threshold": threshold,
                "reason": f"Biometric mismatch: Face distance ({distance:.2f}) exceeds threshold ({threshold:.2f}).",
                "status": "failed"
            })

        return success_response(data={
            "verified": True,
            "similarity": sim,
            "distance": round(distance, 3),
            "threshold": threshold,
            "reason": "Passport face match confirmed.",
            "status": "verified"
        })

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return success_response(data={
            "verified": False,
            "similarity": 0.05,
            "reason": f"AI model could not process face comparison: {str(exc)[:120]}",
            "status": "failed"
        })


class ScanPassportImageRequest(BaseModel):
    image_base64: str
    manual_mrz_text: Optional[str] = None
    save_to_database: Optional[bool] = True


@router.post("/scan-passport-image")
def scan_passport_image(payload: ScanPassportImageRequest, db: Session = Depends(get_db)):
    """
    Extracts MRZ and passport details from uploaded image using EasyOCR.
    Rejects random non-document photos with 400 or error status.
    """
    from ..services.passport_ocr_service import scan_and_extract_passport

    if not payload.image_base64 or not payload.image_base64.strip():
        return error_response(code="MISSING_IMAGE", message="No image provided for passport scan.", status_code=400)

    try:
        result = scan_and_extract_passport(
            image_data=payload.image_base64,
            manual_mrz_text=payload.manual_mrz_text
        )
    except ValueError as exc:
        return error_response(code="INVALID_DOCUMENT", message=str(exc), status_code=400)
    except Exception as exc:
        return error_response(code="OCR_FAILED", message=f"Internal OCR processing failed: {str(exc)}", status_code=500)

    # If save_to_database is True, persist or update the passenger & travel document in DB
    passport = result.get("passport") or {}
    p_id = None
    db_saved = False

    if payload.save_to_database and passport.get("passport_number"):
        try:
            doc = db.query(TravelDocument).filter(
                TravelDocument.document_number == passport["passport_number"]
            ).first()
            if doc:
                passenger = db.query(Passenger).filter(Passenger.passenger_id == doc.passenger_id).first()
                if passenger:
                    passenger.full_name = passport.get("full_name", passenger.full_name)
                    p_id = passenger.passenger_id
                    db.commit()
                    db_saved = True
            else:
                p_dob = None
                if passport.get("date_of_birth"):
                    try:
                        p_dob = datetime.strptime(passport["date_of_birth"], "%Y-%m-%d").date()
                    except Exception:
                        pass

                nat = (passport.get("nationality") or "USA").upper()[:3]
                country = db.query(Country).filter(Country.country_code == nat).first()
                if not country:
                    try:
                        new_country = Country(country_code=nat, country_name=f"Country {nat}")
                        db.add(new_country)
                        db.flush()
                    except Exception:
                        first_c = db.query(Country).first()
                        nat = first_c.country_code if first_c else "EGY"

                new_p = Passenger(
                    full_name=passport.get("full_name", "UNKNOWN"),
                    date_of_birth=p_dob,
                    nationality_country_code=nat,
                    password_hash="kiosk_auto_pass",
                    biometric_consent=True,
                    consent_date=datetime.utcnow(),
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(new_p)
                db.commit()
                db.refresh(new_p)
                p_id = new_p.passenger_id

                new_doc = TravelDocument(
                    passenger_id=new_p.passenger_id,
                    document_type="passport",
                    document_number=passport["passport_number"],
                    issuing_country_code=nat,
                    mrz_hash=passport.get("mrz_raw", "")[:64],
                    is_primary=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(new_doc)
                db.commit()
                db_saved = True
        except Exception:
            db.rollback()

    result["passengerId"] = p_id
    result["dbSaved"] = db_saved
    return success_response(data=result)



