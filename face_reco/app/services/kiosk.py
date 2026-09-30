"""Smart check-in kiosk orchestration."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    BoardingStatus,
    Checkpoint,
    FaceVerificationLog,
    Passenger,
    SecurityStatus,
    VerificationResult,
)
from app.services.boarding_pass import issue_boarding_pass, save_boarding_pass_files
from app.services.face_embedder import face_embedder
from app.services.kiosk_models import CheckInSession, CheckInStatus, KioskBoardingPass
from app.services.liveness import check_liveness
from app.services.passport_ocr import extract_passport_face, parse_passport_image, passport_to_dict
from app.services.similarity import cosine_similarity, is_match

PASSES_DIR = Path(__file__).resolve().parents[2] / "data" / "boarding_passes"


def create_session(db: Session, *, kiosk_id: str = "KIOSK-01", flight_id: str = "GV101") -> CheckInSession:
    session = CheckInSession(
        kiosk_id=kiosk_id,
        flight_id=flight_id,
        status=CheckInStatus.AWAITING_FACE,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _get_session(db: Session, session_id: int) -> CheckInSession:
    session = db.get(CheckInSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Kiosk session not found")
    return session


def capture_live_face(
    db: Session,
    *,
    session_id: int,
    frames: list[np.ndarray],
    skip_liveness: bool = False,
) -> dict:
    session = _get_session(db, session_id)
    if not frames:
        raise HTTPException(status_code=400, detail="No camera frames provided")

    live = check_liveness(frames) if not skip_liveness else None
    if live is not None and not live.passed:
        session.status = CheckInStatus.FAILED
        session.message = f"Liveness failed: {', '.join(live.reasons)}"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Liveness detection failed",
                "liveness": {
                    "passed": False,
                    "score": float(live.score),
                    "reasons": live.reasons,
                },
            },
        )

    face_frame = frames[-1]
    try:
        embedding = face_embedder.extract(face_frame)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Face capture failed: {exc}") from exc

    session.live_embedding = face_embedder.to_json(embedding)
    session.status = CheckInStatus.AWAITING_PASSPORT
    session.message = "Please place your passport on the scanner"
    if live is not None:
        session.liveness_score = float(live.score)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.session_id,
        "status": session.status.value,
        "message": session.message,
        "liveness": None
        if live is None
        else {
            "passed": bool(live.passed),
            "score": float(live.score),
            "reasons": list(live.reasons),
        },
        "embedding_dim": int(embedding.shape[0]),
    }


def scan_passport(
    db: Session,
    *,
    session_id: int,
    passport_image: np.ndarray,
    mrz_text: str | None = None,
) -> dict:
    session = _get_session(db, session_id)
    if not session.live_embedding:
        raise HTTPException(status_code=400, detail="Capture live face before scanning passport")

    try:
        passport = parse_passport_image(passport_image, mrz_text=mrz_text)
        face_crop = extract_passport_face(passport_image)
        passport_embedding = face_embedder.extract(face_crop)
    except Exception as exc:
        session.status = CheckInStatus.FAILED
        session.message = str(exc)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Passport scan failed: {exc}") from exc

    # Expiry validation
    try:
        expiry = datetime.strptime(passport.expiry_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if expiry.date() < datetime.now(timezone.utc).date():
            session.status = CheckInStatus.FAILED
            session.message = "Passport expired"
            db.commit()
            raise HTTPException(status_code=400, detail="Passport expired")
    except ValueError:
        pass

    session.passport_embedding = face_embedder.to_json(passport_embedding)
    session.passport_number = passport.passport_number
    session.passenger_name = passport.full_name
    session.nationality = passport.nationality
    session.date_of_birth = passport.date_of_birth
    session.expiry_date = passport.expiry_date
    session.mrz_raw = passport.mrz_raw
    session.status = CheckInStatus.READY_TO_VERIFY
    session.message = "Passport captured — verifying identity"
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.session_id,
        "status": session.status.value,
        "message": session.message,
        "passport": passport_to_dict(passport),
    }


def verify_identity(db: Session, *, session_id: int) -> dict:
    session = _get_session(db, session_id)
    if not session.live_embedding or not session.passport_embedding:
        raise HTTPException(status_code=400, detail="Face and passport must be captured first")

    live = face_embedder.from_json(session.live_embedding)
    passport = face_embedder.from_json(session.passport_embedding)
    similarity = cosine_similarity(live, passport)
    matched = is_match(similarity)

    session.similarity = similarity
    if not matched:
        session.status = CheckInStatus.FAILED
        session.message = "Identity verification failed"
        db.add(
            FaceVerificationLog(
                passenger_id=None,
                checkpoint=Checkpoint.ENTRY,
                similarity=similarity,
                camera_id=session.kiosk_id,
                result=VerificationResult.NO_MATCH,
            )
        )
        db.commit()
        return {
            "session_id": session.session_id,
            "verified": False,
            "similarity": similarity,
            "threshold": settings.similarity_threshold,
            "status": session.status.value,
            "message": "Camera face does not match passport photo",
        }

    # Upsert passenger and mark ready for baggage drop
    passenger = (
        db.query(Passenger).filter(Passenger.passport == session.passport_number).first()
    )
    if passenger is None:
        passenger = Passenger(
            name=session.passenger_name or "UNKNOWN",
            passport=session.passport_number or f"TMP-{session.session_id}",
            flight_id=session.flight_id,
            security_status=SecurityStatus.PENDING,
            boarding_status=BoardingStatus.NOT_BOARDED,
        )
        db.add(passenger)
        db.flush()
    else:
        passenger.name = session.passenger_name or passenger.name
        passenger.flight_id = session.flight_id

    session.passenger_id = passenger.passenger_id
    session.status = CheckInStatus.VERIFIED
    session.message = "Identity Verified"

    bp = issue_boarding_pass(
        passenger_name=passenger.name,
        passport_number=passenger.passport,
        flight_id=session.flight_id,
    )
    files = save_boarding_pass_files(bp, PASSES_DIR)

    record = KioskBoardingPass(
        session_id=session.session_id,
        passenger_id=passenger.passenger_id,
        pass_id=bp.pass_id,
        flight_id=bp.flight_id,
        seat=bp.seat,
        gate=bp.gate,
        barcode_value=bp.barcode_value,
        html_path=files["html"],
        status=bp.status,
    )
    db.add(record)
    db.add(
        FaceVerificationLog(
            passenger_id=passenger.passenger_id,
            checkpoint=Checkpoint.ENTRY,
            similarity=similarity,
            camera_id=session.kiosk_id,
            result=VerificationResult.MATCH,
        )
    )
    session.status = CheckInStatus.BOARDING_PASS_ISSUED
    session.message = "Identity Verified — proceed to baggage drop"
    db.commit()
    db.refresh(session)
    db.refresh(record)

    return {
        "session_id": session.session_id,
        "verified": True,
        "similarity": similarity,
        "threshold": settings.similarity_threshold,
        "status": session.status.value,
        "message": session.message,
        "passenger": {
            "passenger_id": passenger.passenger_id,
            "name": passenger.name,
            "passport": passenger.passport,
            "flight_id": passenger.flight_id,
        },
        "boarding_pass": {
            "pass_id": record.pass_id,
            "flight_id": record.flight_id,
            "seat": record.seat,
            "gate": record.gate,
            "barcode_value": record.barcode_value,
            "status": record.status,
            "print_url": f"/kiosk/boarding-pass/{record.pass_id}",
            "barcode_data_uri": files["data_uri"],
        },
    }


def decode_data_url_or_bytes(raw: bytes) -> np.ndarray:
    import cv2

    if not raw:
        raise HTTPException(status_code=400, detail="Empty image")
    # data URL support
    if raw.startswith(b"data:"):
        raw = base64.b64decode(raw.split(b",", 1)[1])
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image")
    return image
