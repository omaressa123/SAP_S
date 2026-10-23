"""IoT MQTT bridge persistence models.

Tables:
  - iotcommandlog: every command dispatched to field hardware, with
    acknowledgement tracking, timeouts, retries and failure details.
  - iottelemetrylog: raw telemetry ingested from devices (observability).

Stored in the existing PostgreSQL database. No Redis/Kafka/new infrastructure.
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class IotCommandLog(Base):
    __tablename__ = 'iotcommandlog'

    command_id = Column(String, primary_key=True, index=True)
    correlation_id = Column(String, index=True)
    device_id = Column(String, nullable=False, index=True)
    module = Column(String, nullable=False, index=True)
    topic = Column(String, nullable=False)
    command = Column(String, nullable=False)  # OPEN, CLOSE, LOCK, UNLOCK, DIVERT, ...
    payload = Column(Text)  # JSON command payload sent to the device
    dispatched_by_agent = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default='pending')  # pending, dispatched, acknowledged, failed, timeout, rejected
    ack_received = Column(Boolean, default=False)
    ack_payload = Column(Text)
    ack_latency_ms = Column(Integer)
    timeout_seconds = Column(Integer, default=30)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    dispatched_at = Column(DateTime)
    acknowledged_at = Column(DateTime)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class IotTelemetryLog(Base):
    __tablename__ = 'iottelemetrylog'

    telemetry_id = Column(String, primary_key=True, index=True)
    device_id = Column(String, nullable=False, index=True)
    module = Column(String, nullable=False, index=True)
    topic = Column(String, nullable=False)
    payload = Column(Text)  # JSON telemetry payload
    message_id = Column(String, index=True)  # for duplicate protection
    processed = Column(Boolean, default=False)
    routed_to = Column(String)  # agent(s) the telemetry was forwarded to
    received_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
