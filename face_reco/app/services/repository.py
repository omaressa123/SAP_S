"""Database repository helpers for passengers, embeddings, and logs."""

import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Checkpoint,
    FaceEmbedding,
    FaceVerificationLog,
    Passenger,
    VerificationResult,
)
from app.services.face_embedder import face_embedder


def save_embedding(
    db: Session,
    *,
    passenger_id: int,
    embedding: np.ndarray,
    model_version: str | None = None,
) -> FaceEmbedding:
    row = FaceEmbedding(
        passenger_id=passenger_id,
        model_version=model_version or settings.model_version,
        embedding=face_embedder.to_json(embedding),
    )
    db.add(row)
    db.flush()
    passenger = db.get(Passenger, passenger_id)
    if passenger is not None:
        passenger.embedding_id = row.embedding_id
    db.commit()
    db.refresh(row)
    return row


def get_passenger(db: Session, passenger_id: int) -> Passenger | None:
    return db.get(Passenger, passenger_id)


def get_passenger_by_passport(db: Session, passport: str) -> Passenger | None:
    return db.query(Passenger).filter(Passenger.passport == passport).first()


def save_log(
    db: Session,
    *,
    checkpoint: Checkpoint,
    camera_id: str,
    result: VerificationResult,
    similarity: float | None = None,
    passenger_id: int | None = None,
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
