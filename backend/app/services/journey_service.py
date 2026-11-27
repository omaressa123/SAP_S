"""End-to-End Passenger Journey, QR Pairing, Touchpoint Sync & WebSocket Manager."""
from __future__ import annotations

import asyncio
import json
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket
from sqlalchemy.orm import Session

from ..models.check_in import Bag, BagCheckpointLog, CheckInRecord
from ..models.flights import Airline, Airport, Booking, Flight, Notification
from ..models.identity import Passenger, PassengerDevice, TravelDocument
from ..models.journey import JourneyPairingToken, JourneyTouchpointEvent, PassengerJourney
from ..models.security import BoardingGate
from ..utils.auth import create_access_token

JOURNEY_STAGES: List[Dict[str, str]] = [
    {"key": "ekiosk_checkin", "label": "eKiosk Check-in", "next_action": "Proceed to Baggage Drop"},
    {"key": "baggage_drop", "label": "Baggage Drop", "next_action": "Proceed to Security Gate"},
    {"key": "security_gate", "label": "Security Gate", "next_action": "Proceed to Boarding Gate"},
    {"key": "boarding_gate", "label": "Boarding Gate", "next_action": "Present boarding pass & face ID to board"},
    {"key": "boarded", "label": "Boarded", "next_action": "Take your seat for departure"},
    {"key": "flight_departed", "label": "Flight Departed", "next_action": "In flight to destination"},
    {"key": "flight_arrived", "label": "Flight Arrived", "next_action": "Proceed to Baggage Claim"},
    {"key": "baggage_collection", "label": "Baggage Collection", "next_action": "Collect your luggage from carousel"},
    {"key": "journey_completed", "label": "Journey Completed", "next_action": "Welcome! Journey complete"},
]

STAGE_INDEX = {s["key"]: idx for idx, s in enumerate(JOURNEY_STAGES)}

BAGGAGE_STATUS_PROGRESS = {
    "registered": (0.10, "Registered"),
    "accepted_at_baggage_drop": (0.20, "Accepted at Baggage Drop"),
    "checked_in": (0.20, "Accepted at Baggage Drop"),
    "in_processing": (0.30, "In Processing"),
    "processing": (0.30, "In Processing"),
    "security_screening": (0.40, "Security Screening"),
    "screening": (0.40, "Security Screening"),
    "loaded": (0.55, "Loaded"),
    "in_transit": (0.65, "In Transit"),
    "arrived_at_destination": (0.75, "Arrived at Destination"),
    "transferred_to_carousel": (0.85, "Transferred to Baggage Carousel"),
    "ready_for_collection": (0.95, "Ready for Collection"),
    "collected": (1.00, "Collected"),
}


class JourneyWebSocketManager:
    """Manages active WebSocket connections per journey_id."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, journey_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(journey_id, set()).add(ws)

    def disconnect(self, journey_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(journey_id)
        if conns:
            conns.discard(ws)
            if not conns:
                self._connections.pop(journey_id, None)

    async def broadcast(self, journey_id: str, payload: Dict[str, Any]) -> None:
        conns = list(self._connections.get(journey_id, set()))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001
                self.disconnect(journey_id, ws)

    def broadcast_sync(self, journey_id: str, payload: Dict[str, Any]) -> None:
        if journey_id not in self._connections:
            return
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast(journey_id, payload))
        except RuntimeError:
            pass


journey_ws_manager = JourneyWebSocketManager()


def get_or_create_journey(
    db: Session,
    passenger_id: int,
    booking_id: Optional[int] = None,
    flight_id: Optional[int] = None,
    checkin_id: Optional[int] = None,
) -> PassengerJourney:
    """Retrieve the active PassengerJourney for this passenger/booking or create one."""
    q = db.query(PassengerJourney).filter(
        PassengerJourney.passenger_id == passenger_id,
        PassengerJourney.journey_status != "completed",
    )
    if booking_id is not None:
        existing = q.filter(PassengerJourney.booking_id == booking_id).first()
        if existing:
            return existing
    existing = q.order_by(PassengerJourney.created_at.desc()).first()
    if existing:
        if booking_id and not existing.booking_id:
            existing.booking_id = booking_id
        if flight_id and not existing.flight_id:
            existing.flight_id = flight_id
        if checkin_id and not existing.checkin_id:
            existing.checkin_id = checkin_id
        return existing

    # Resolve booking/flight from DB if omitted
    if booking_id is None:
        bk = (
            db.query(Booking)
            .filter(Booking.passenger_id == passenger_id)
            .order_by(Booking.booking_id.desc())
            .first()
        )
        if bk:
            booking_id = bk.booking_id
            if flight_id is None:
                flight_id = bk.flight_id

    bp_code = f"BP-{passenger_id}-{flight_id or 0}-{secrets.token_hex(3).upper()}"
    j = PassengerJourney(
        journey_id=f"JRN-{uuid.uuid4().hex[:10].upper()}",
        passenger_id=passenger_id,
        booking_id=booking_id,
        flight_id=flight_id,
        checkin_id=checkin_id,
        boarding_pass_code=bp_code,
        current_stage="ekiosk_checkin",
        journey_status="in_progress",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(j)
    db.flush()
    return j


def generate_pairing_token(
    db: Session,
    journey: PassengerJourney,
    ttl_minutes: int = 15,
) -> JourneyPairingToken:
    """Create a secure, time-limited, one-time pairing token (no PII inside)."""
    raw_token = secrets.token_urlsafe(24)
    tok = JourneyPairingToken(
        token_id=f"TOK-{uuid.uuid4().hex[:10]}",
        token=raw_token,
        journey_id=journey.journey_id,
        passenger_id=journey.passenger_id,
        expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
        used_at=None,
        is_revoked=False,
        created_at=datetime.utcnow(),
    )
    db.add(tok)
    db.flush()
    return tok


def extract_token_string(qr_or_token: str) -> str:
    raw = (qr_or_token or "").strip()
    if raw.startswith("SA-PAIR:"):
        return raw[len("SA-PAIR:"):].strip()
    return raw


def claim_pairing_token(
    db: Session,
    raw_token: str,
    device_uuid: str,
    device_type: str = "expo_mobile",
    push_token: Optional[str] = None,
    app_version: Optional[str] = "1.0.0",
) -> Dict[str, Any]:
    """Validate one-time QR pairing token, associate device, and issue passenger JWT."""
    token_val = extract_token_string(raw_token)
    if not token_val:
        raise ValueError("INVALID_QR_TOKEN: Empty pairing token.")

    tok = db.query(JourneyPairingToken).filter(JourneyPairingToken.token == token_val).first()
    if not tok:
        raise ValueError("INVALID_QR_TOKEN: Pairing token not found.")
    if tok.is_revoked:
        raise ValueError("REVOKED_QR_TOKEN: Pairing token has been revoked.")
    if tok.used_at is not None:
        raise ValueError("QR_ALREADY_USED: Pairing token has already been claimed.")
    if tok.expires_at < datetime.utcnow():
        raise ValueError("EXPIRED_QR_TOKEN: Pairing token has expired.")

    journey = db.query(PassengerJourney).filter(PassengerJourney.journey_id == tok.journey_id).first()
    if not journey:
        raise ValueError("JOURNEY_NOT_FOUND: Associated passenger journey does not exist.")

    passenger = db.query(Passenger).filter(Passenger.passenger_id == tok.passenger_id).first()
    if not passenger:
        raise ValueError("PASSENGER_NOT_FOUND: Associated passenger does not exist.")

    # Mark one-time token used
    tok.used_at = datetime.utcnow()
    tok.paired_device_uuid = device_uuid

    # Associate or update PassengerDevice
    dev = (
        db.query(PassengerDevice)
        .filter(PassengerDevice.passenger_id == passenger.passenger_id)
        .order_by(PassengerDevice.device_id.desc())
        .first()
    )
    if not dev:
        dev = PassengerDevice(
            passenger_id=passenger.passenger_id,
            device_type=device_type,
            push_token=push_token or device_uuid,
            app_version=app_version,
            last_active=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        db.add(dev)
        db.flush()
    else:
        dev.device_type = device_type
        if push_token:
            dev.push_token = push_token
        dev.app_version = app_version or dev.app_version
        dev.last_active = datetime.utcnow()

    journey.paired_device_id = dev.device_id
    journey.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(journey)

    access_token = create_access_token(
        data={
            "sub": str(passenger.passenger_id),
            "role": "passenger",
            "journey_id": journey.journey_id,
            "device_id": dev.device_id,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "journey": build_journey_snapshot(db, journey),
    }


def record_touchpoint(
    db: Session,
    *,
    journey: PassengerJourney,
    stage: str,
    status: str = "completed",
    location: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
) -> JourneyTouchpointEvent:
    """Idempotently record a touchpoint event and update journey stage + WebSocket."""
    if idempotency_key:
        existing = (
            db.query(JourneyTouchpointEvent)
            .filter(JourneyTouchpointEvent.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return existing

    # Prevent duplicate completed events for the exact same stage on this journey
    if status == "completed":
        dup = (
            db.query(JourneyTouchpointEvent)
            .filter(
                JourneyTouchpointEvent.journey_id == journey.journey_id,
                JourneyTouchpointEvent.stage == stage,
                JourneyTouchpointEvent.status == "completed",
            )
            .first()
        )
        if dup:
            return dup

    evt = JourneyTouchpointEvent(
        event_id=f"TP-{uuid.uuid4().hex[:10]}",
        journey_id=journey.journey_id,
        passenger_id=journey.passenger_id,
        stage=stage,
        status=status,
        idempotency_key=idempotency_key,
        location=location,
        details_json=json.dumps(details or {}),
        occurred_at=datetime.utcnow(),
    )
    db.add(evt)

    # Advance journey stage monotonically when completed
    cur_idx = STAGE_INDEX.get(journey.current_stage, 0)
    new_idx = STAGE_INDEX.get(stage, cur_idx)
    if status == "completed" and new_idx >= cur_idx:
        journey.current_stage = stage
    if stage == "journey_completed" and status == "completed":
        journey.journey_status = "completed"
        journey.completed_at = datetime.utcnow()
    elif status in ("delayed", "failed"):
        journey.journey_status = status

    journey.updated_at = datetime.utcnow()

    # Persist passenger notification
    stage_meta = next((s for s in JOURNEY_STAGES if s["key"] == stage), {"label": stage, "next_action": ""})
    notif = Notification(
        passenger_id=journey.passenger_id,
        channel="push",
        notification_type=f"journey_{stage}",
        content=f"{stage_meta['label']}: {status.upper()}" + (f" at {location}" if location else ""),
        related_entity_type="passengerjourney",
        related_entity_id=None,
        sent_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(notif)
    db.flush()

    snapshot = build_journey_snapshot(db, journey)
    journey_ws_manager.broadcast_sync(
        journey.journey_id,
        {
            "type": "journey_update",
            "stage": stage,
            "status": status,
            "location": location,
            "journey": snapshot,
        },
    )
    return evt


def build_journey_snapshot(db: Session, journey: PassengerJourney) -> Dict[str, Any]:
    """Assemble authoritative passenger, flight, boarding pass, baggage & timeline snapshot."""
    pax = db.query(Passenger).filter(Passenger.passenger_id == journey.passenger_id).first()
    doc = (
        db.query(TravelDocument)
        .filter(TravelDocument.passenger_id == journey.passenger_id)
        .order_by(TravelDocument.is_primary.desc(), TravelDocument.document_id.desc())
        .first()
    )
    booking = (
        db.query(Booking).filter(Booking.booking_id == journey.booking_id).first()
        if journey.booking_id
        else db.query(Booking).filter(Booking.passenger_id == journey.passenger_id).order_by(Booking.booking_id.desc()).first()
    )
    flight_id = journey.flight_id or (booking.flight_id if booking else None)
    flight = db.query(Flight).filter(Flight.flight_id == flight_id).first() if flight_id else None

    airline = db.query(Airline).filter(Airline.airline_id == flight.airline_id).first() if flight and flight.airline_id else None
    origin = db.query(Airport).filter(Airport.airport_id == flight.origin_airport_id).first() if flight and flight.origin_airport_id else None
    dest = db.query(Airport).filter(Airport.airport_id == flight.destination_airport_id).first() if flight and flight.destination_airport_id else None
    gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == flight.boarding_gate_id).first() if flight and flight.boarding_gate_id else None

    gate_num = gate.gate_number if gate else None
    sched_dep = flight.scheduled_departure if flight else None
    boarding_time = (sched_dep - timedelta(minutes=40)).strftime("%H:%M") if sched_dep else None

    # Masked document reference (never expose raw full passport number unnecessarily)
    doc_masked = None
    if doc and doc.document_number:
        dn = str(doc.document_number)
        doc_masked = ("*" * max(0, len(dn) - 4)) + dn[-4:]

    # Bags
    bags_q = db.query(Bag).filter(Bag.passenger_id == journey.passenger_id)
    if booking:
        bags_q = bags_q.filter(Bag.booking_id == booking.booking_id)
    bag_rows = bags_q.order_by(Bag.bag_id.asc()).all()
    bags_data = []
    for b in bag_rows:
        st_key = (b.current_status or "registered").lower().replace(" ", "_")
        prog, st_label = BAGGAGE_STATUS_PROGRESS.get(st_key, (0.25, b.current_status or "In Processing"))
        cps = (
            db.query(BagCheckpointLog)
            .filter(BagCheckpointLog.bag_id == b.bag_id)
            .order_by(BagCheckpointLog.timestamp.asc())
            .all()
        )
        bags_data.append({
            "bag_id": b.bag_id,
            "rfid_tag": b.rfid_tag,
            "qr_code": b.qr_code,
            "weight_kg": float(b.weight_kg) if b.weight_kg is not None else None,
            "status": st_label,
            "status_key": st_key,
            "progress": prog,
            "location": b.current_location,
            "carousel": journey.baggage_carousel,
            "checkpoints": [
                {
                    "checkpoint_type": c.checkpoint_type,
                    "location": c.location,
                    "timestamp": c.timestamp.isoformat() + "Z" if c.timestamp else None,
                }
                for c in cps
            ],
        })

    # Timeline from recorded touchpoints
    events = (
        db.query(JourneyTouchpointEvent)
        .filter(JourneyTouchpointEvent.journey_id == journey.journey_id)
        .order_by(JourneyTouchpointEvent.occurred_at.asc())
        .all()
    )
    events_by_stage: Dict[str, JourneyTouchpointEvent] = {e.stage: e for e in events}
    cur_idx = STAGE_INDEX.get(journey.current_stage, 0)

    timeline = []
    for idx, st_def in enumerate(JOURNEY_STAGES):
        key = st_def["key"]
        ev = events_by_stage.get(key)
        if ev:
            t_status = ev.status
        elif journey.journey_status == "completed" or idx < cur_idx:
            t_status = "completed"
        elif idx == cur_idx + 1 and journey.journey_status == "in_progress":
            t_status = "in_progress"
        else:
            t_status = "upcoming"

        label = st_def["label"]
        if key == "boarding_gate" and gate_num:
            label = f"Boarding Gate {gate_num}"

        timeline.append({
            "stage": key,
            "label": label,
            "status": t_status,
            "timestamp": ev.occurred_at.isoformat() + "Z" if ev and ev.occurred_at else None,
            "location": ev.location if ev else (gate_num if key == "boarding_gate" else None),
            "details": json.loads(ev.details_json) if ev and ev.details_json else {},
            "next_action": st_def["next_action"],
        })

    notifs = (
        db.query(Notification)
        .filter(Notification.passenger_id == journey.passenger_id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )

    return {
        "journey_id": journey.journey_id,
        "current_stage": journey.current_stage,
        "journey_status": journey.journey_status,
        "baggage_carousel": journey.baggage_carousel,
        "updated_at": journey.updated_at.isoformat() + "Z" if journey.updated_at else None,
        "completed_at": journey.completed_at.isoformat() + "Z" if journey.completed_at else None,
        "passenger": {
            "passenger_id": pax.passenger_id if pax else journey.passenger_id,
            "full_name": pax.full_name if pax else "Passenger",
            "nationality": pax.nationality_country_code if pax else None,
            "document_type": doc.document_type if doc else None,
            "document_number_masked": doc_masked,
            "biometric_consent": bool(pax.biometric_consent) if pax else False,
            "photo_url": doc.document_image_url if doc else None,
        },
        "booking": {
            "booking_id": booking.booking_id if booking else None,
            "booking_reference": booking.booking_reference if booking else None,
            "seat_number": booking.seat_number if booking else None,
            "booking_class": booking.booking_class if booking else None,
            "booking_status": booking.booking_status if booking else None,
        },
        "flight": {
            "flight_id": flight.flight_id if flight else None,
            "flight_number": flight.flight_number if flight else None,
            "airline": airline.name if airline else None,
            "airline_iata": airline.iata_code if airline else None,
            "origin_iata": origin.iata_code if origin else None,
            "origin_city": origin.city if origin else None,
            "destination_iata": dest.iata_code if dest else None,
            "destination_city": dest.city if dest else None,
            "scheduled_departure": sched_dep.isoformat() + "Z" if sched_dep else None,
            "actual_departure": flight.actual_departure.isoformat() + "Z" if flight and flight.actual_departure else None,
            "boarding_gate": gate_num,
            "boarding_time": boarding_time,
            "status": (flight.status or "Scheduled") if flight else "Scheduled",
        },
        "boarding_pass": {
            "boarding_pass_code": journey.boarding_pass_code,
            "passenger_name": pax.full_name if pax else "Passenger",
            "flight_number": flight.flight_number if flight else None,
            "seat": booking.seat_number if booking else None,
            "gate": gate_num,
            "boarding_time": boarding_time,
            "qr_payload": journey.boarding_pass_code,
        },
        "bags": bags_data,
        "timeline": timeline,
        "notifications": [
            {
                "id": str(n.notification_id),
                "type": n.notification_type,
                "content": n.content,
                "sent_at": n.sent_at.isoformat() + "Z" if n.sent_at else None,
                "unread": n.read_at is None,
            }
            for n in notifs
        ],
    }
