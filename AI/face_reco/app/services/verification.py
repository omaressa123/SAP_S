from datetime import datetime, timezone

import numpy as np
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    BoardingStatus,
    Checkpoint,
    FaceEmbedding,
    FaceVerificationLog,
    Passenger,
    SecurityStatus,
    VerificationResult,
)
from app.schemas import MatchCandidate, PassengerOut, VerifyResponse
from app.services.face_embedder import face_embedder
from app.services.faiss_index import faiss_index
from app.services.similarity import is_match


async def read_image_bytes(file: UploadFile) -> np.ndarray:
    import cv2

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image upload")
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    return image


def extract_embedding(image: np.ndarray) -> np.ndarray:
    try:
        return face_embedder.extract(image)
    except Exception as exc:  # DeepFace raises various errors on no-face
        raise HTTPException(status_code=400, detail=f"Face extraction failed: {exc}") from exc


def search_top_matches(db: Session, embedding: np.ndarray) -> list[MatchCandidate]:
    hits = faiss_index.search(embedding, top_k=settings.faiss_top_k)
    matches: list[MatchCandidate] = []
    for passenger_id, similarity in hits:
        passenger = db.get(Passenger, passenger_id)
        if passenger is None:
            continue
        matches.append(
            MatchCandidate(
                passenger_id=passenger.passenger_id,
                name=passenger.name,
                passport=passenger.passport,
                flight_id=passenger.flight_id,
                similarity=similarity,
            )
        )
    return matches


def log_verification(
    db: Session,
    *,
    checkpoint: Checkpoint,
    camera_id: str,
    result: VerificationResult,
    similarity: float | None,
    passenger_id: int | None,
) -> FaceVerificationLog:
    entry = FaceVerificationLog(
        passenger_id=passenger_id,
        checkpoint=checkpoint,
        similarity=similarity,
        camera_id=camera_id,
        result=result,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def enroll_passenger(
    db: Session,
    *,
    name: str,
    passport: str,
    flight_id: str,
    image: np.ndarray,
) -> Passenger:
    existing = db.query(Passenger).filter(Passenger.passport == passport).first()
    if existing:
        raise HTTPException(status_code=409, detail="Passenger with this passport already enrolled")

    embedding = extract_embedding(image)

    passenger = Passenger(
        name=name,
        passport=passport,
        flight_id=flight_id,
        security_status=SecurityStatus.PENDING,
        boarding_status=BoardingStatus.NOT_BOARDED,
    )
    db.add(passenger)
    db.flush()

    face_row = FaceEmbedding(
        passenger_id=passenger.passenger_id,
        model_version=settings.model_version,
        embedding=face_embedder.to_json(embedding),
    )
    db.add(face_row)
    db.flush()

    passenger.embedding_id = face_row.embedding_id
    db.commit()
    db.refresh(passenger)

    faiss_index.add(passenger.passenger_id, embedding)
    return passenger


def verify_entry(db: Session, embedding: np.ndarray, camera_id: str) -> VerifyResponse:
    """Checkpoint 1 — identify passenger at airport entry."""
    matches = search_top_matches(db, embedding)
    best = matches[0] if matches else None
    similarity = best.similarity if best else None
    now = datetime.now(timezone.utc)

    if best and is_match(best.similarity):
        passenger = db.get(Passenger, best.passenger_id)
        log = log_verification(
            db,
            checkpoint=Checkpoint.ENTRY,
            camera_id=camera_id,
            result=VerificationResult.MATCH,
            similarity=similarity,
            passenger_id=best.passenger_id,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.ENTRY,
            result=VerificationResult.MATCH,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            passenger=PassengerOut.model_validate(passenger),
            top_matches=matches,
            message=f"Passenger identified: {passenger.name}",
            verification_id=log.verification_id,
            timestamp=now,
        )

    log = log_verification(
        db,
        checkpoint=Checkpoint.ENTRY,
        camera_id=camera_id,
        result=VerificationResult.NO_MATCH,
        similarity=similarity,
        passenger_id=None,
    )
    return VerifyResponse(
        checkpoint=Checkpoint.ENTRY,
        result=VerificationResult.NO_MATCH,
        similarity=similarity,
        threshold=settings.similarity_threshold,
        camera_id=camera_id,
        passenger=None,
        top_matches=matches,
        message="No enrolled passenger matched",
        verification_id=log.verification_id,
        timestamp=now,
    )


def verify_security(db: Session, embedding: np.ndarray, camera_id: str) -> VerifyResponse:
    """Checkpoint 2 — security gate: identify + check security status → open/deny."""
    matches = search_top_matches(db, embedding)
    best = matches[0] if matches else None
    similarity = best.similarity if best else None
    now = datetime.now(timezone.utc)

    if not best or not is_match(best.similarity):
        log = log_verification(
            db,
            checkpoint=Checkpoint.SECURITY,
            camera_id=camera_id,
            result=VerificationResult.NO_MATCH,
            similarity=similarity,
            passenger_id=None,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.SECURITY,
            result=VerificationResult.NO_MATCH,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            top_matches=matches,
            message="Passenger not found — gate denied",
            verification_id=log.verification_id,
            timestamp=now,
        )

    passenger = db.get(Passenger, best.passenger_id)
    if passenger.security_status == SecurityStatus.CLEARED:
        result = VerificationResult.GATE_OPEN
        message = f"Security cleared for {passenger.name} — gate open"
    elif passenger.security_status == SecurityStatus.FLAGGED:
        result = VerificationResult.GATE_DENIED
        message = f"Passenger {passenger.name} is flagged — gate denied"
    else:
        # Auto-clear on successful face match at security for demo flow
        passenger.security_status = SecurityStatus.CLEARED
        db.commit()
        db.refresh(passenger)
        result = VerificationResult.GATE_OPEN
        message = f"Security check passed for {passenger.name} — gate open"

    log = log_verification(
        db,
        checkpoint=Checkpoint.SECURITY,
        camera_id=camera_id,
        result=result,
        similarity=similarity,
        passenger_id=passenger.passenger_id,
    )
    return VerifyResponse(
        checkpoint=Checkpoint.SECURITY,
        result=result,
        similarity=similarity,
        threshold=settings.similarity_threshold,
        camera_id=camera_id,
        passenger=PassengerOut.model_validate(passenger),
        top_matches=matches,
        message=message,
        verification_id=log.verification_id,
        timestamp=now,
    )


def verify_boarding(
    db: Session,
    embedding: np.ndarray,
    camera_id: str,
    expected_flight_id: str | None = None,
) -> VerifyResponse:
    """Checkpoint 3 — boarding: identify + flight match → boarding status."""
    matches = search_top_matches(db, embedding)
    best = matches[0] if matches else None
    similarity = best.similarity if best else None
    now = datetime.now(timezone.utc)

    if not best or not is_match(best.similarity):
        log = log_verification(
            db,
            checkpoint=Checkpoint.BOARDING,
            camera_id=camera_id,
            result=VerificationResult.NO_MATCH,
            similarity=similarity,
            passenger_id=None,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.BOARDING,
            result=VerificationResult.NO_MATCH,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            top_matches=matches,
            message="Passenger not found — boarding denied",
            verification_id=log.verification_id,
            timestamp=now,
        )

    passenger = db.get(Passenger, best.passenger_id)

    if expected_flight_id and passenger.flight_id != expected_flight_id:
        passenger.boarding_status = BoardingStatus.DENIED
        db.commit()
        db.refresh(passenger)
        log = log_verification(
            db,
            checkpoint=Checkpoint.BOARDING,
            camera_id=camera_id,
            result=VerificationResult.FLIGHT_MISMATCH,
            similarity=similarity,
            passenger_id=passenger.passenger_id,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.BOARDING,
            result=VerificationResult.FLIGHT_MISMATCH,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            passenger=PassengerOut.model_validate(passenger),
            top_matches=matches,
            message=(
                f"Flight mismatch: passenger on {passenger.flight_id}, "
                f"gate expects {expected_flight_id}"
            ),
            verification_id=log.verification_id,
            timestamp=now,
        )

    if passenger.security_status != SecurityStatus.CLEARED:
        passenger.boarding_status = BoardingStatus.DENIED
        db.commit()
        db.refresh(passenger)
        log = log_verification(
            db,
            checkpoint=Checkpoint.BOARDING,
            camera_id=camera_id,
            result=VerificationResult.GATE_DENIED,
            similarity=similarity,
            passenger_id=passenger.passenger_id,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.BOARDING,
            result=VerificationResult.GATE_DENIED,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            passenger=PassengerOut.model_validate(passenger),
            top_matches=matches,
            message=f"Boarding denied — {passenger.name} has not cleared security",
            verification_id=log.verification_id,
            timestamp=now,
        )

    if passenger.boarding_status == BoardingStatus.BOARDED:
        log = log_verification(
            db,
            checkpoint=Checkpoint.BOARDING,
            camera_id=camera_id,
            result=VerificationResult.GATE_DENIED,
            similarity=similarity,
            passenger_id=passenger.passenger_id,
        )
        return VerifyResponse(
            checkpoint=Checkpoint.BOARDING,
            result=VerificationResult.GATE_DENIED,
            similarity=similarity,
            threshold=settings.similarity_threshold,
            camera_id=camera_id,
            passenger=PassengerOut.model_validate(passenger),
            top_matches=matches,
            message=f"Boarding denied — {passenger.name} already boarded",
            verification_id=log.verification_id,
            timestamp=now,
        )

    passenger.boarding_status = BoardingStatus.BOARDED
    db.commit()
    db.refresh(passenger)
    log = log_verification(
        db,
        checkpoint=Checkpoint.BOARDING,
        camera_id=camera_id,
        result=VerificationResult.GATE_OPEN,
        similarity=similarity,
        passenger_id=passenger.passenger_id,
    )
    return VerifyResponse(
        checkpoint=Checkpoint.BOARDING,
        result=VerificationResult.GATE_OPEN,
        similarity=similarity,
        threshold=settings.similarity_threshold,
        camera_id=camera_id,
        passenger=PassengerOut.model_validate(passenger),
        top_matches=matches,
        message=f"Boarding approved for {passenger.name} on flight {passenger.flight_id}",
        verification_id=log.verification_id,
        timestamp=now,
    )
