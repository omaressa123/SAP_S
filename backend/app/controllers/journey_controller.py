"""End-to-End Passenger Journey & QR Pairing API endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.check_in import Bag, BagCheckpointLog
from ..models.identity import PassengerDevice
from ..models.journey import PassengerJourney
from ..services import journey_service as js
from ..utils.auth import decode_access_token, verify_api_key
from ..utils.response_envelope import error_response, success_response

router = APIRouter()


class GeneratePairRequest(BaseModel):
    passenger_id: int
    booking_id: Optional[int] = None
    flight_id: Optional[int] = None
    ttl_minutes: int = 15


class ClaimPairRequest(BaseModel):
    token: str
    device_uuid: str
    device_type: str = "expo_mobile"
    push_token: Optional[str] = None
    app_version: Optional[str] = "1.0.0"


class TouchpointRequest(BaseModel):
    journey_id: Optional[str] = None
    passenger_id: Optional[int] = None
    stage: str
    status: str = "completed"
    location: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    idempotency_key: Optional[str] = None


class BaggageCollectRequest(BaseModel):
    journey_id: Optional[str] = None
    passenger_id: Optional[int] = None
    bag_id: Optional[int] = None
    carousel: Optional[str] = None


class PushTokenRequest(BaseModel):
    push_token: str


def _resolve_journey_from_auth(
    db: Session,
    authorization: Optional[str],
    x_api_key: Optional[str],
    journey_id: Optional[str],
    passenger_id: Optional[int],
) -> Optional[PassengerJourney]:
    if authorization and authorization.lower().startswith("bearer "):
        payload = decode_access_token(authorization.split(" ", 1)[1].strip())
        if payload:
            jid = payload.get("journey_id")
            if jid:
                j = db.query(PassengerJourney).filter(PassengerJourney.journey_id == jid).first()
                if j:
                    return j
            sub = payload.get("sub")
            if sub and str(sub).isdigit():
                return (
                    db.query(PassengerJourney)
                    .filter(PassengerJourney.passenger_id == int(sub))
                    .order_by(PassengerJourney.created_at.desc())
                    .first()
                )
    if x_api_key:
        if journey_id:
            return db.query(PassengerJourney).filter(PassengerJourney.journey_id == journey_id).first()
        if passenger_id:
            return (
                db.query(PassengerJourney)
                .filter(PassengerJourney.passenger_id == passenger_id)
                .order_by(PassengerJourney.created_at.desc())
                .first()
            )
    return None


@router.post("/pair/generate", dependencies=[Depends(verify_api_key)])
def generate_pair(payload: GeneratePairRequest, db: Session = Depends(get_db)):
    """Generate a time-limited, one-time QR pairing token for a passenger journey."""
    journey = js.get_or_create_journey(
        db,
        passenger_id=payload.passenger_id,
        booking_id=payload.booking_id,
        flight_id=payload.flight_id,
    )
    tok = js.generate_pairing_token(db, journey, ttl_minutes=payload.ttl_minutes)
    db.commit()
    return success_response(data={
        "journey_id": journey.journey_id,
        "boarding_pass_code": journey.boarding_pass_code,
        "pairing_token": tok.token,
        "qr_payload": f"SA-PAIR:{tok.token}",
        "expires_at": tok.expires_at.isoformat() + "Z",
    })


@router.post("/pair/claim")
def claim_pair(payload: ClaimPairRequest, db: Session = Depends(get_db)):
    """Claim a one-time QR pairing token from the Expo mobile app."""
    try:
        res = js.claim_pairing_token(
            db,
            raw_token=payload.token,
            device_uuid=payload.device_uuid,
            device_type=payload.device_type,
            push_token=payload.push_token,
            app_version=payload.app_version,
        )
        return success_response(data=res)
    except ValueError as exc:
        msg = str(exc)
        code = msg.split(":", 1)[0] if ":" in msg else "PAIRING_FAILED"
        return error_response(code=code, message=msg, status_code=400)


@router.get("/me")
def get_my_journey(
    journey_id: Optional[str] = Query(None),
    passenger_id: Optional[int] = Query(None),
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-KEY"),
    db: Session = Depends(get_db),
):
    """Return authoritative passenger journey, flight, boarding pass, baggage & timeline."""
    journey = _resolve_journey_from_auth(db, authorization, x_api_key, journey_id, passenger_id)
    if not journey:
        return error_response(code="JOURNEY_NOT_FOUND", message="Authenticated passenger journey not found.", status_code=404)
    return success_response(data=js.build_journey_snapshot(db, journey))


@router.post("/touchpoint", dependencies=[Depends(verify_api_key)])
def post_touchpoint(payload: TouchpointRequest, db: Session = Depends(get_db)):
    """Record an idempotent passenger touchpoint event and sync to mobile."""
    journey = None
    if payload.journey_id:
        journey = db.query(PassengerJourney).filter(PassengerJourney.journey_id == payload.journey_id).first()
    elif payload.passenger_id:
        journey = js.get_or_create_journey(db, passenger_id=payload.passenger_id)
    if not journey:
        return error_response(code="JOURNEY_NOT_FOUND", message="Journey not found.", status_code=404)

    evt = js.record_touchpoint(
        db,
        journey=journey,
        stage=payload.stage,
        status=payload.status,
        location=payload.location,
        details=payload.details,
        idempotency_key=payload.idempotency_key,
    )
    db.commit()
    return success_response(data={
        "event_id": evt.event_id,
        "journey": js.build_journey_snapshot(db, journey),
    })


@router.post("/baggage/collect", dependencies=[Depends(verify_api_key)])
def collect_baggage(payload: BaggageCollectRequest, db: Session = Depends(get_db)):
    """Mark passenger baggage as Collected at carousel and complete journey if ready."""
    journey = None
    if payload.journey_id:
        journey = db.query(PassengerJourney).filter(PassengerJourney.journey_id == payload.journey_id).first()
    elif payload.passenger_id:
        journey = (
            db.query(PassengerJourney)
            .filter(PassengerJourney.passenger_id == payload.passenger_id)
            .order_by(PassengerJourney.created_at.desc())
            .first()
        )
    if not journey:
        return error_response(code="JOURNEY_NOT_FOUND", message="Journey not found.", status_code=404)

    if payload.carousel:
        journey.baggage_carousel = payload.carousel

    q = db.query(Bag).filter(Bag.passenger_id == journey.passenger_id)
    if payload.bag_id:
        q = q.filter(Bag.bag_id == payload.bag_id)
    bags = q.all()
    for b in bags:
        b.current_status = "collected"
        b.current_location = journey.baggage_carousel or "Baggage Claim"
        b.updated_at = datetime.utcnow()
        db.add(BagCheckpointLog(
            bag_id=b.bag_id,
            checkpoint_type="collected",
            location=b.current_location,
            timestamp=datetime.utcnow(),
        ))

    js.record_touchpoint(
        db,
        journey=journey,
        stage="baggage_collection",
        status="completed",
        location=journey.baggage_carousel or "Baggage Claim",
        details={"collected_bags": [b.rfid_tag for b in bags]},
    )

    # Check if all passenger bags are collected -> complete journey
    remaining = (
        db.query(Bag)
        .filter(Bag.passenger_id == journey.passenger_id, Bag.current_status != "collected")
        .count()
    )
    if remaining == 0:
        js.record_touchpoint(
            db,
            journey=journey,
            stage="journey_completed",
            status="completed",
            location=journey.baggage_carousel or "Arrival Hall",
        )

    db.commit()
    return success_response(data=js.build_journey_snapshot(db, journey))


@router.post("/device/push-token")
def register_push_token(
    payload: PushTokenRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        return error_response(code="UNAUTHORIZED", message="Missing bearer token.", status_code=401)
    claims = decode_access_token(authorization.split(" ", 1)[1].strip())
    if not claims or not claims.get("device_id"):
        return error_response(code="UNAUTHORIZED", message="Invalid session token.", status_code=401)
    dev = db.query(PassengerDevice).filter(PassengerDevice.device_id == int(claims["device_id"])).first()
    if dev:
        dev.push_token = payload.push_token
        dev.last_active = datetime.utcnow()
        db.commit()
    return success_response(data={"registered": True})


@router.websocket("/ws/{journey_id}")
async def journey_websocket(ws: WebSocket, journey_id: str):
    await js.journey_ws_manager.connect(journey_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        js.journey_ws_manager.disconnect(journey_id, ws)
