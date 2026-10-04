"""Emergency / smoke detection alerts for the operations dashboard."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.database import Base
from app.models import utcnow


class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    alert_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    alert_type: Mapped[str] = mapped_column(String(64), nullable=False)
    zone: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def raise_smoke_alert(db: Session, *, zone: str, message: str | None = None) -> EmergencyAlert:
    alert = EmergencyAlert(
        alert_type="SMOKE",
        zone=zone,
        message=message or f"Smoke detected in {zone}",
        active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def list_active_alerts(db: Session) -> list[EmergencyAlert]:
    return (
        db.query(EmergencyAlert)
        .filter(EmergencyAlert.active.is_(True))
        .order_by(EmergencyAlert.alert_id.desc())
        .all()
    )
