"""Passenger Journey, QR Pairing Token, and Touchpoint Event models."""
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from ..database import Base


class PassengerJourney(Base):
    __tablename__ = "passengerjourney"

    journey_id = Column(String, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey("passenger.passenger_id"), index=True, nullable=False)
    booking_id = Column(Integer, ForeignKey("booking.booking_id"), index=True, nullable=True)
    flight_id = Column(Integer, ForeignKey("flight.flight_id"), index=True, nullable=True)
    checkin_id = Column(Integer, ForeignKey("checkinrecord.checkin_id"), nullable=True)
    boarding_pass_code = Column(String, unique=True, index=True, nullable=True)
    current_stage = Column(String, nullable=False, default="ekiosk_checkin")
    journey_status = Column(String, nullable=False, default="in_progress")  # in_progress, completed, delayed, failed
    paired_device_id = Column(Integer, ForeignKey("passengerdevice.device_id"), nullable=True)
    baggage_carousel = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class JourneyPairingToken(Base):
    __tablename__ = "journeypairingtoken"

    token_id = Column(String, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    journey_id = Column(String, ForeignKey("passengerjourney.journey_id"), index=True, nullable=False)
    passenger_id = Column(Integer, ForeignKey("passenger.passenger_id"), index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    paired_device_uuid = Column(String, nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class JourneyTouchpointEvent(Base):
    __tablename__ = "journeytouchpointevent"

    event_id = Column(String, primary_key=True, index=True)
    journey_id = Column(String, ForeignKey("passengerjourney.journey_id"), index=True, nullable=False)
    passenger_id = Column(Integer, ForeignKey("passenger.passenger_id"), index=True, nullable=False)
    stage = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default="completed")  # completed, in_progress, delayed, failed
    idempotency_key = Column(String, unique=True, index=True, nullable=True)
    location = Column(String, nullable=True)
    details_json = Column(Text, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow, index=True)
