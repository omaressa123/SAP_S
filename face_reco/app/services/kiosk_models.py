"""SQLAlchemy models for smart check-in kiosk sessions."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models import utcnow


class CheckInStatus(str, enum.Enum):
    AWAITING_FACE = "AWAITING_FACE"
    AWAITING_PASSPORT = "AWAITING_PASSPORT"
    READY_TO_VERIFY = "READY_TO_VERIFY"
    VERIFIED = "VERIFIED"
    BOARDING_PASS_ISSUED = "BOARDING_PASS_ISSUED"
    FAILED = "FAILED"


class CheckInSession(Base):
    __tablename__ = "checkin_sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kiosk_id: Mapped[str] = mapped_column(String(64), default="KIOSK-01", nullable=False)
    flight_id: Mapped[str] = mapped_column(String(64), nullable=False, default="GV101")
    status: Mapped[CheckInStatus] = mapped_column(
        Enum(CheckInStatus, native_enum=False),
        default=CheckInStatus.AWAITING_FACE,
        nullable=False,
    )
    passenger_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("passengers.passenger_id"), nullable=True
    )
    passenger_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    passport_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(8), nullable=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(16), nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(8), nullable=True)
    mrz_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    live_embedding: Mapped[str | None] = mapped_column(Text, nullable=True)
    passport_embedding: Mapped[str | None] = mapped_column(Text, nullable=True)
    liveness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    similarity: Mapped[float | None] = mapped_column(Float, nullable=True)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class KioskBoardingPass(Base):
    __tablename__ = "kiosk_boarding_passes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("checkin_sessions.session_id"))
    passenger_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("passengers.passenger_id"), nullable=True
    )
    pass_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    flight_id: Mapped[str] = mapped_column(String(64), nullable=False)
    seat: Mapped[str] = mapped_column(String(8), nullable=False)
    gate: Mapped[str] = mapped_column(String(16), nullable=False)
    barcode_value: Mapped[str] = mapped_column(String(128), nullable=False)
    html_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="READY_FOR_BAGGAGE_DROP")
    printed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
