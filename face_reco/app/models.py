import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Checkpoint(str, enum.Enum):
    ENTRY = "ENTRY"
    SECURITY = "SECURITY"
    BOARDING = "BOARDING"


class VerificationResult(str, enum.Enum):
    MATCH = "MATCH"
    NO_MATCH = "NO_MATCH"
    GATE_OPEN = "GATE_OPEN"
    GATE_DENIED = "GATE_DENIED"
    FLIGHT_MISMATCH = "FLIGHT_MISMATCH"


class SecurityStatus(str, enum.Enum):
    CLEARED = "CLEARED"
    PENDING = "PENDING"
    FLAGGED = "FLAGGED"


class BoardingStatus(str, enum.Enum):
    NOT_BOARDED = "NOT_BOARDED"
    BOARDED = "BOARDED"
    DENIED = "DENIED"


class Passenger(Base):
    __tablename__ = "passengers"

    passenger_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    passport: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    flight_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    nationality: Mapped[str | None] = mapped_column(String(10), nullable=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(20), nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mrz_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("face_embeddings.embedding_id"), nullable=True
    )
    security_status: Mapped[SecurityStatus] = mapped_column(
        Enum(SecurityStatus, native_enum=False),
        default=SecurityStatus.PENDING,
        nullable=False,
    )
    boarding_status: Mapped[BoardingStatus] = mapped_column(
        Enum(BoardingStatus, native_enum=False),
        default=BoardingStatus.NOT_BOARDED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    embedding: Mapped["FaceEmbedding | None"] = relationship(
        "FaceEmbedding",
        foreign_keys=[embedding_id],
        post_update=True,
        uselist=False,
    )
    embeddings: Mapped[list["FaceEmbedding"]] = relationship(
        "FaceEmbedding",
        back_populates="passenger",
        foreign_keys="FaceEmbedding.passenger_id",
    )
    logs: Mapped[list["FaceVerificationLog"]] = relationship(
        "FaceVerificationLog", back_populates="passenger"
    )


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    embedding_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    passenger_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("passengers.passenger_id"), nullable=False, index=True
    )
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    embedding: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of 512 floats
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    passenger: Mapped["Passenger"] = relationship(
        "Passenger",
        back_populates="embeddings",
        foreign_keys=[passenger_id],
    )


class FaceVerificationLog(Base):
    __tablename__ = "face_verification_logs"

    verification_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    passenger_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("passengers.passenger_id"), nullable=True, index=True
    )
    checkpoint: Mapped[Checkpoint] = mapped_column(
        Enum(Checkpoint, native_enum=False), nullable=False
    )
    similarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    camera_id: Mapped[str] = mapped_column(String(64), nullable=False, default="CAM-01")
    result: Mapped[VerificationResult] = mapped_column(
        Enum(VerificationResult, native_enum=False), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    passenger: Mapped["Passenger | None"] = relationship("Passenger", back_populates="logs")
