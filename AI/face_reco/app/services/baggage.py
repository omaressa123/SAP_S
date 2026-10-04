"""Lost-baggage tracking via RFID scan events."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.database import Base
from app.models import utcnow


class BaggageItem(Base):
    __tablename__ = "baggage_items"

    bag_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    passenger_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("passengers.passenger_id"))
    rfid_tag: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    last_location: Mapped[str] = mapped_column(String(120), nullable=False, default="CHECKIN")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="checked_in")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class BaggageScan(Base):
    __tablename__ = "baggage_scans"

    scan_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bag_id: Mapped[int] = mapped_column(Integer, ForeignKey("baggage_items.bag_id"), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def register_bag(
    db: Session,
    *,
    rfid_tag: str,
    passenger_id: int | None = None,
    location: str = "CHECKIN",
) -> BaggageItem:
    bag = BaggageItem(
        rfid_tag=rfid_tag,
        passenger_id=passenger_id,
        last_location=location,
        status="checked_in",
    )
    db.add(bag)
    db.flush()
    db.add(BaggageScan(bag_id=bag.bag_id, location=location))
    db.commit()
    db.refresh(bag)
    return bag


def scan_bag(db: Session, *, rfid_tag: str, location: str) -> BaggageItem:
    bag = db.query(BaggageItem).filter(BaggageItem.rfid_tag == rfid_tag).first()
    if bag is None:
        raise ValueError(f"Unknown RFID tag: {rfid_tag}")
    bag.last_location = location
    bag.updated_at = datetime.now(timezone.utc)
    if location.upper().startswith("LOST") or location.upper() == "LOST":
        bag.status = "lost"
    else:
        bag.status = "in_transit"
    db.add(BaggageScan(bag_id=bag.bag_id, location=location))
    db.commit()
    db.refresh(bag)
    return bag


def find_bag_by_rfid(db: Session, rfid_tag: str) -> BaggageItem | None:
    return db.query(BaggageItem).filter(BaggageItem.rfid_tag == rfid_tag).first()
