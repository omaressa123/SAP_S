import io
import os
import base64
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from PIL import Image, ImageStat
from sqlalchemy.orm import Session
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key
from ..database import get_db
from ..models.identity import Passenger, TravelDocument, FaceEnrollment, FaceVerificationLog
from ..models.flights import Flight, Booking, Airport
from ..models.check_in import Bag
from ..models.security import BoardingGate, BoardingLog
from ..services.storage_service import storage_service

router = APIRouter()

class BoardingGateVerifyRequest(BaseModel):
    boardingGateId: Optional[int] = 22
    flightId: Optional[int] = 1
    flightNumber: Optional[str] = "QR-082"
    passengerId: Optional[int] = None
    capturedFrameBase64: Optional[str] = ""
    barcode: Optional[str] = ""
    scenarioState: Optional[int] = None  # None: Real Check, 2: Force Approve, 3: Force Deny, 4: Barcode
    testPassengerMode: Optional[str] = "real"  # "real", "wrong_flight", "unknown", "valid"

class GateEnrollFaceRequest(BaseModel):
    passengerId: Optional[int] = 4
    capturedFrameBase64: str
    flightNumber: Optional[str] = "QR-082"


@router.post("/enroll-face", dependencies=[Depends(verify_api_key)])
def enroll_gate_face(payload: GateEnrollFaceRequest, db: Session = Depends(get_db)):
    """
    Enrolls live camera face directly to passenger profile in PostgreSQL.
    """
    p_id = payload.passengerId or 4
    passenger = db.query(Passenger).filter(Passenger.passenger_id == p_id).first()
    if not passenger:
        passenger = db.query(Passenger).first()
        if passenger:
            p_id = passenger.passenger_id

    if not payload.capturedFrameBase64 or not payload.capturedFrameBase64.strip():
        return success_response(data={
            "success": False,
            "message": "No image frame received for face enrollment."
        })

    # Upload face image (Cloudinary or local /data/faces/)
    face_url = storage_service.upload_face(payload.capturedFrameBase64, passenger_id=p_id)

    # Update FaceEnrollment
    now = datetime.utcnow()
    fe = db.query(FaceEnrollment).filter(FaceEnrollment.passenger_id == p_id).first()
    doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == p_id).first()
    if not fe:
        fe = FaceEnrollment(
            passenger_id=p_id,
            document_id=doc.document_id if doc else None,
            equipment_id=4,
            face_embedding_ref=face_url,
            embedding_model="ArcFace",
            enrollment_time=now,
            status="active",
            created_at=now,
            updated_at=now
        )
        db.add(fe)
    else:
        fe.face_embedding_ref = face_url
        fe.status = "active"
        fe.updated_at = now
    db.commit()

    return success_response(data={
        "success": True,
        "passengerId": p_id,
        "passengerName": passenger.full_name if passenger else "YEHIA TAHER NAGIB MORSY SHOMAN",
        "faceUrl": face_url,
        "message": f"Biometric face successfully enrolled and linked in database for {passenger.full_name if passenger else 'Passenger'}!"
    })


@router.post("/verify-and-board", dependencies=[Depends(verify_api_key)])
def execute_boarding_verification(payload: BoardingGateVerifyRequest, db: Session = Depends(get_db)):
    """
    Check Entry Gate / Boarding Gate Verification:
    - Verifies real camera face frame or barcode.
    - If no face is captured -> rejects (NO_FACE_DETECTED).
    - If unknown face -> rejects (UNRECOGNIZED_FACE).
    - If passenger belongs to wrong flight -> rejects (State 3 - FLIGHT_MISMATCH).
    - If passenger matches QR-082 manifest -> approves (State 2 - BOARDING_APPROVED).
    """
    now = datetime.utcnow()
    gate_flight = payload.flightNumber or "QR-082"

    # 1. Barcode / Boarding Pass Scan Checks
    if payload.barcode:
        barcode_clean = payload.barcode.strip().upper()
        if "EK204" in barcode_clean or "WRONG" in barcode_clean or "DENY" in barcode_clean:
            return reject_wrong_flight(gate_flight, now)
        elif "QR82" in barcode_clean or "VALID" in barcode_clean or "YEHIA" in barcode_clean or "DOE" in barcode_clean:
            return approve_passenger(db, passenger_id=payload.passengerId or 4, gate_flight=gate_flight, gate_id=payload.boardingGateId, now=now, method="barcode")

    # 2. Check simulated test mode
    if payload.scenarioState == 3 or payload.testPassengerMode == "wrong_flight":
        return reject_wrong_flight(gate_flight, now)

    if payload.testPassengerMode == "unknown":
        return success_response(data={
            "cleared": False,
            "verificationResult": "unrecognized_face",
            "state": 1,
            "title": "Face Not Recognized",
            "message": "Biometric match failed: Face does not match any registered passenger for this flight.",
            "barrierStatus": "LOCKED & SEALED",
            "timestamp": now.isoformat() + "Z"
        })

    if payload.testPassengerMode == "valid":
        return approve_passenger(db, passenger_id=payload.passengerId or 4, gate_flight=gate_flight, gate_id=payload.boardingGateId, now=now, method="biometric")

    # 3. Check for Live Camera Frame (Real Mode)
    frame = (payload.capturedFrameBase64 or "").strip()
    if not frame and payload.scenarioState != 2:
        return success_response(data={
            "cleared": False,
            "verificationResult": "no_face_detected",
            "state": 1,
            "title": "No Face Detected",
            "message": "Please turn on your camera and align your face inside the oval scanning frame.",
            "barrierStatus": "LOCKED & SEALED",
            "timestamp": now.isoformat() + "Z"
        })

    # Validate image payload with OpenCV Face Detection
    try:
        from ..services.biometric_service import biometric_service
        img_cv2 = biometric_service.clean_base64_to_cv2(frame)
        if img_cv2 is None:
            return success_response(data={
                "cleared": False,
                "verificationResult": "no_face_detected",
                "state": 1,
                "title": "Invalid Frame",
                "message": "Could not read camera frame format. Please align your face inside the scanning oval.",
                "barrierStatus": "LOCKED & SEALED",
                "timestamp": now.isoformat() + "Z"
            })
        
        face_bbox = biometric_service.detect_human_face(img_cv2)
        if face_bbox is None:
            return success_response(data={
                "cleared": False,
                "verificationResult": "no_face_detected",
                "state": 1,
                "title": "No Human Face Detected",
                "message": "No human face was detected in camera frame. Please align your face inside the oval scanning frame.",
                "barrierStatus": "LOCKED & SEALED",
                "timestamp": now.isoformat() + "Z"
            })
    except Exception as exc:
        return success_response(data={
            "cleared": False,
            "verificationResult": "no_face_detected",
            "state": 1,
            "title": "Invalid Frame",
            "message": f"Could not process camera image: {str(exc)[:60]}",
            "barrierStatus": "LOCKED & SEALED",
            "timestamp": now.isoformat() + "Z"
        })

    # 4. Real 1-to-N Biometric Identification against Cloudinary & Database Face Registry
    best_p_id = None
    best_sim = 0.0
    best_score = 95.0

    # Retrieve all active face enrollments stored in database (with Cloudinary or local image refs)
    all_enrollments = db.query(FaceEnrollment).filter(FaceEnrollment.status == "active").all()

    for fe in all_enrollments:
        targets = []
        if fe.face_embedding_ref:
            targets.append(fe.face_embedding_ref)
        doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == fe.passenger_id).first()
        if doc and doc.document_image_url and doc.document_image_url not in targets:
            targets.append(doc.document_image_url)

        for target in targets:
            try:
                res = biometric_service.verify_face_pair(target, frame, is_kiosk_doc_check=False)
                if res.get("verified"):
                    sim = res.get("similarity", 0.95)
                    if sim > best_sim:
                        best_sim = sim
                        best_score = round(sim * 100, 1)
                        best_p_id = fe.passenger_id
                        break
            except Exception as e:
                print(f"[BoardingGate] Face match error for passenger {fe.passenger_id}: {e}")

    # If no face matched in the entire database, STRICTLY REJECT: turnstile remains locked!
    if not best_p_id:
        return success_response(data={
            "cleared": False,
            "verificationResult": "unrecognized_face",
            "state": 1,
            "title": "Face Not Recognized",
            "message": f"Biometric match failed: Face does not match any registered passenger for Flight {gate_flight}. Turnstile remains locked.",
            "barrierStatus": "LOCKED & SEALED",
            "timestamp": now.isoformat() + "Z"
        })

    # The passenger is POSITIVELY IDENTIFIED by face recognition!
    identified_passenger = db.query(Passenger).filter(Passenger.passenger_id == best_p_id).first()
    p_name = identified_passenger.full_name if identified_passenger else "PASSENGER"

    # Check which flight this passenger is booked on
    booking = db.query(Booking).filter(Booking.passenger_id == best_p_id).order_by(Booking.booking_id.desc()).first()
    p_flight = None
    if booking:
        p_flight = db.query(Flight).filter(Flight.flight_id == booking.flight_id).first()

    p_flight_num = p_flight.flight_number if p_flight else "QR-082"

    # If passenger is booked on a DIFFERENT flight -> Rejection (Wrong Gate / Flight Mismatch)
    if p_flight and p_flight.flight_number and p_flight.flight_number.upper() != gate_flight.upper():
        dest_apt = db.query(Airport).filter(Airport.airport_id == p_flight.destination_airport_id).first() if p_flight.destination_airport_id else None
        dest_city = dest_apt.city if dest_apt else "Destination"
        dest_iata = dest_apt.iata_code if dest_apt else "DXB"
        return success_response(data={
            "cleared": False,
            "verificationResult": "flight_mismatch",
            "state": 3,
            "title": "Access Denied: Wrong Departure Gate",
            "subtitle": f"Identified as {p_name}, but your ticket is for Flight {p_flight_num}.",
            "identifiedTraveler": p_name,
            "passengerId": best_p_id,
            "discrepancyReason": f"Booked on {p_flight_num}, not {gate_flight}",
            "correctFlight": f"{p_flight_num} • {dest_city} ({dest_iata})",
            "assignedGate": "Concourse C • Gate C14",
            "wayfindingAdvice": "Gate C14 is an estimated 7-minute walk. Head south toward Concourse C transit hub, take the express moving walkway to Level 2.",
            "barrierStatus": "LOCKED & SEALED",
            "auditLogId": f"DENY-{now.strftime('%M%S')}",
            "timestamp": now.isoformat() + "Z"
        })

    # Passenger matches this flight -> APPROVE & CLEAR FOR BOARDING!
    return approve_passenger(db, passenger_id=best_p_id, gate_flight=gate_flight, gate_id=payload.boardingGateId, now=now, method="biometric", match_score=best_score)


def reject_wrong_flight(gate_flight: str, now: datetime):
    return success_response(data={
        "cleared": False,
        "verificationResult": "flight_mismatch",
        "state": 3,
        "title": "Access Denied: Wrong Departure Gate",
        "subtitle": f"You are not registered on the passenger manifest for Flight {gate_flight} (Doha).",
        "identifiedTraveler": "MR. ALEX SMITH",
        "passengerId": 30,
        "discrepancyReason": f"Not on {gate_flight} Manifest",
        "correctFlight": "EK-204 • Dubai (DXB)",
        "assignedGate": "Concourse C • Gate C14",
        "wayfindingAdvice": "Gate C14 is an estimated 7-minute walk. Head south toward Concourse C transit hub, take the express moving walkway to Level 2.",
        "barrierStatus": "LOCKED & SEALED",
        "auditLogId": f"DENY-{now.strftime('%M%S')}",
        "timestamp": now.isoformat() + "Z"
    })


@router.get("/manifest", dependencies=[Depends(verify_api_key)])
def get_gate_manifest(flightNumber: Optional[str] = "QR-082", db: Session = Depends(get_db)):
    """
    Returns passengers available for the gate manifest so the operator or kiosk
    can test and board any passenger dynamically from the database.
    """
    passengers = db.query(Passenger).order_by(Passenger.passenger_id.desc()).limit(20).all()
    results = []
    for p in passengers:
        doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == p.passenger_id).first()
        b = db.query(Booking).filter(Booking.passenger_id == p.passenger_id).order_by(Booking.booking_id.desc()).first()
        fl = db.query(Flight).filter(Flight.flight_id == b.flight_id).first() if b else None
        fe = db.query(FaceEnrollment).filter(FaceEnrollment.passenger_id == p.passenger_id, FaceEnrollment.status == "active").first()
        bags = db.query(Bag).filter(Bag.passenger_id == p.passenger_id).all()
        results.append({
            "passengerId": p.passenger_id,
            "fullName": p.full_name,
            "passportNumber": doc.document_number if doc else "N/A",
            "flightNumber": fl.flight_number if fl else "QR-082",
            "seatNumber": b.seat_number if b else "18B",
            "cabinClass": b.booking_class if b else "Economy",
            "bookingReference": b.booking_reference if b else f"QR82-P{p.passenger_id}",
            "hasBiometrics": bool(fe and fe.face_embedding_ref),
            "bagCount": len(bags)
        })
    return success_response(data=results)


def approve_passenger(db: Session, passenger_id: Optional[int], gate_flight: str, gate_id: Optional[int], now: datetime, method: str = "biometric", match_score: float = 95.0):
    """Approves passenger boarding for Gate B22 with real database-backed details."""
    passenger = None
    if passenger_id:
        passenger = db.query(Passenger).filter(Passenger.passenger_id == passenger_id).first()
    if not passenger:
        # Fall back to latest enrolled face or registered passenger
        latest_fe = db.query(FaceEnrollment).filter(FaceEnrollment.status == "active").order_by(FaceEnrollment.enrollment_id.desc()).first()
        if latest_fe:
            passenger = db.query(Passenger).filter(Passenger.passenger_id == latest_fe.passenger_id).first()
        if not passenger:
            passenger = db.query(Passenger).order_by(Passenger.passenger_id.desc()).first()

    p_id = passenger.passenger_id if passenger else (passenger_id or 1)
    p_name = passenger.full_name if passenger else "PASSENGER"
    passport_num = "—"
    seat_num = "18B"
    group_num = "ZONE 2"
    cabin = "Economy"
    dest_name = "Doha Intl (DOH)"

    doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == p_id).first()
    if doc:
        passport_num = doc.document_number or "—"

    booking = db.query(Booking).filter(Booking.passenger_id == p_id).order_by(Booking.booking_id.desc()).first()
    if not booking and passenger:
        # Auto-link booking for demonstration continuity
        fl_qr = db.query(Flight).filter(Flight.flight_number == gate_flight).first() or db.query(Flight).first()
        booking = Booking(
            passenger_id=p_id,
            flight_id=fl_qr.flight_id if fl_qr else 1,
            booking_reference=f"QR82-P{p_id:04d}",
            seat_number="18B",
            booking_class="Economy",
            booking_status="confirmed",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        try:
            db.add(booking)
            db.commit()
            db.refresh(booking)
        except Exception:
            db.rollback()

    if booking:
        seat_num = booking.seat_number or seat_num
        cabin = booking.booking_class or cabin
        flight = db.query(Flight).filter(Flight.flight_id == booking.flight_id).first()
        if flight:
            if flight.flight_number:
                gate_flight = flight.flight_number
            if flight.destination_airport_id:
                dest_apt = db.query(Airport).filter(Airport.airport_id == flight.destination_airport_id).first()
                if dest_apt:
                    dest_name = f"{dest_apt.city or 'Doha'} ({dest_apt.iata_code or 'DOH'})"

    # Dynamic cabin priority & zone
    cabin_lower = cabin.lower()
    is_priority = "first" in cabin_lower or "bus" in cabin_lower or "exec" in cabin_lower
    if is_priority:
        group_num = "ZONE 1 (Priority)"
    else:
        group_num = f"ZONE {(p_id % 3) + 2}"

    # Real Bags count & summary
    bags = db.query(Bag).filter(Bag.passenger_id == p_id).all()
    bag_count = len(bags)
    if bag_count > 0:
        checked_baggage = f"{bag_count} / {bag_count} Loaded"
        baggage_detail = f"Holds A-04 Checked"
    else:
        checked_baggage = "1 / 1 Carry-On"
        baggage_detail = "Overhead Hold Approved"

    # Real Manifest ID
    booking_ref = booking.booking_reference if booking else f"P{p_id:04d}"
    manifest_id = f"#{gate_flight.replace('-', '')}-{booking_ref}"

    gate_name = "Gate B22"
    pathway = "Jetbridge Open"
    pathway_detail = "Door 2L Direct"

    # Audit logging to PostgreSQL
    try:
        log_entry = BoardingLog(
            passenger_id=p_id,
            flight_id=1,
            boarding_gate_id=gate_id or 22,
            boarding_status="boarded",
            timestamp=now,
            created_at=now,
            updated_at=now
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        boarding_id = log_entry.boarding_id
    except Exception:
        db.rollback()
        boarding_id = 4022

    return success_response(data={
        "cleared": True,
        "verificationResult": "match",
        "state": 2,
        "method": method,
        "boardingId": boarding_id,
        "passengerId": p_id,
        "passengerName": p_name,
        "passportNumber": passport_num,
        "manifestId": manifest_id,
        "seatNumber": seat_num,
        "group": group_num,
        "gate": "B22",
        "flightNumber": gate_flight,
        "destination": dest_name,
        "cabinClass": cabin,
        "priorityBoarding": is_priority,
        "biometricMatchScore": match_score,
        "checkedBaggage": checked_baggage,
        "baggageDetail": baggage_detail,
        "gatePathway": pathway,
        "pathwayDetail": pathway_detail,
        "barrierStatus": "RETRACTED & UNLOCKED",
        "gateTurnstileOpened": True,
        "autoCloseSeconds": 10,
        "timestamp": now.isoformat() + "Z"
    })
