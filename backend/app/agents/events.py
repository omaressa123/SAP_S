"""Event system for the agent layer.

Provides event creation, validation, routing, correlation IDs, idempotency,
timestamps, and persistence. Reuses existing database tables where possible
(airportevent, auditlog, monitoringalert, emergencyevent) and adds new
agent-specific tables (agentdefinition, agenttask, agenteexecution,
workflowexecution, decisionaudit).

No Kafka, Redis, or other new infrastructure is introduced — the existing
PostgreSQL database plus FastAPI dependency injection is the message bus.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid


class EventSource(str, Enum):
    AI_SERVICE = "ai_service"
    IOT_DEVICE = "iot_device"
    API = "api"
    AGENT = "agent"
    SYSTEM = "system"


class EventStatus(str, Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class EventSeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AirportEvent:
    """A normalized airport event that flows through the agent system."""

    event_id: str
    event_type: str
    source: str
    source_id: Optional[str] = None
    correlation_id: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    status: str = EventStatus.RECEIVED.value
    severity: str = EventSeverity.INFO.value
    zone_id: Optional[int] = None
    camera_id: Optional[int] = None
    passenger_id: Optional[int] = None
    bag_id: Optional[int] = None
    flight_id: Optional[int] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "source": self.source,
            "source_id": self.source_id,
            "correlation_id": self.correlation_id,
            "payload": self.payload,
            "status": self.status,
            "severity": self.severity,
            "zone_id": self.zone_id,
            "camera_id": self.camera_id,
            "passenger_id": self.passenger_id,
            "bag_id": self.bag_id,
            "flight_id": self.flight_id,
            "created_at": self.created_at.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }

    @classmethod
    def create(
        cls,
        event_type: str,
        source: str,
        payload: Dict[str, Any] | None = None,
        source_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        severity: str = EventSeverity.INFO.value,
        zone_id: Optional[int] = None,
        camera_id: Optional[int] = None,
        passenger_id: Optional[int] = None,
        bag_id: Optional[int] = None,
        flight_id: Optional[int] = None,
    ) -> "AirportEvent":
        return cls(
            event_id=f"evt_{uuid.uuid4().hex[:12]}",
            event_type=event_type,
            source=source,
            source_id=source_id,
            correlation_id=correlation_id or f"corr_{uuid.uuid4().hex[:12]}",
            payload=payload or {},
            severity=severity,
            zone_id=zone_id,
            camera_id=camera_id,
            passenger_id=passenger_id,
            bag_id=bag_id,
            flight_id=flight_id,
        )


class EventSystem:
    """In-process event bus with persistence to PostgreSQL.

    Events are persisted to the `airportevent` table. Agents subscribe by
    registering handlers with the orchestrator, which routes events by type.
    Idempotency is enforced via event_id — processing the same event_id twice
    is a no-op after the first resolution.
    """

    def __init__(self, db_session_factory):
        self._session_factory = db_session_factory
        self._subscribers: Dict[str, list] = {}
        self._processed: set = set()

    def subscribe(self, event_type: str, callback) -> None:
        self._subscribers.setdefault(event_type, []).append(callback)

    def publish(self, event: AirportEvent) -> AirportEvent:
        """Publish and persist an event. Returns the persisted event."""
        # Idempotency: skip if already processed
        if event.event_id in self._processed:
            return event
        self._processed.add(event.event_id)

        self._persist(event)

        # Notify in-process subscribers
        for cb in self._subscribers.get(event.event_type, []):
            try:
                cb(event)
            except Exception:  # noqa: BLE001
                # Subscriber failures must not break event publishing
                pass

        return event

    def _persist(self, event: AirportEvent) -> None:
        from ..models.agents import AirportEvent as EventModel

        db = self._session_factory()
        try:
            row = EventModel(
                event_id=event.event_id,
                event_type=event.event_type,
                source=event.source,
                source_id=event.source_id,
                correlation_id=event.correlation_id,
                payload=__import__("json").dumps(event.payload),
                status=event.status,
                severity=event.severity,
                zone_id=event.zone_id,
                camera_id=event.camera_id,
                passenger_id=event.passenger_id,
                bag_id=event.bag_id,
                flight_id=event.flight_id,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def mark_resolved(self, event_id: str) -> None:
        from ..models.agents import AirportEvent as EventModel

        db = self._session_factory()
        try:
            row = db.query(EventModel).filter(EventModel.event_id == event_id).first()
            if row:
                row.status = EventStatus.RESOLVED.value
                row.resolved_at = datetime.now(timezone.utc)
                db.commit()
        finally:
            db.close()

    def get_recent(
        self,
        limit: int = 50,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        from ..models.agents import AirportEvent as EventModel

        db = self._session_factory()
        try:
            q = db.query(EventModel).order_by(EventModel.created_at.desc())
            if event_type:
                q = q.filter(EventModel.event_type == event_type)
            if severity:
                q = q.filter(EventModel.severity == severity)
            if status:
                q = q.filter(EventModel.status == status)
            if source:
                q = q.filter(EventModel.source == source)
            rows = q.limit(limit).all()
            return [
                {
                    "event_id": r.event_id,
                    "event_type": r.event_type,
                    "source": r.source,
                    "status": r.status,
                    "severity": r.severity,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "correlation_id": r.correlation_id,
                }
                for r in rows
            ]
        finally:
            db.close()
