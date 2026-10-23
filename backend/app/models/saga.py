"""Persistent Saga models for the multi-step passenger journey.

Tables:
  - sagainstance: one row per durable workflow instance (correlation id,
    status, current step, retry/failure metadata).
  - sagastep: one row per journey step with state, input/output, retry
    counts, and a link to its compensating step.
  - sagacompensation: record of each compensating action and its outcome.

No new infrastructure: stored in the existing PostgreSQL database alongside
the other agent tables (workflowexecution, decisionaudit, agenttask, ...).
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from decimal import Decimal
from ..database import Base


class SagaInstance(Base):
    __tablename__ = 'sagainstance'

    saga_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, default='passenger_journey')
    correlation_id = Column(String, index=True, nullable=False)
    passenger_id = Column(Integer, index=True)
    booking_id = Column(Integer, index=True)
    flight_id = Column(Integer, index=True)
    status = Column(String, nullable=False, default='initiated')
    current_step_index = Column(Integer, default=0)
    input_payload = Column(Text)
    output_payload = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime)

    steps = relationship('SagaStep', back_populates='saga', cascade='all, delete-orphan',
                         order_by='SagaStep.step_index')
    compensations = relationship('SagaCompensation', back_populates='saga',
                                 cascade='all, delete-orphan')


class SagaStep(Base):
    __tablename__ = 'sagastep'

    step_id = Column(String, primary_key=True, index=True)
    saga_id = Column(String, ForeignKey('sagainstance.saga_id'), index=True, nullable=False)
    step_index = Column(Integer, nullable=False)
    name = Column(String, nullable=False)  # identity_verification, baggage_screening, security_clearance, boarding
    agent_id = Column(String, index=True)
    capability = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending')  # pending, running, completed, failed, skipped, compensated
    input_payload = Column(Text)
    output_payload = Column(Text)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    requires_human_review = Column(Boolean, default=False)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    saga = relationship('SagaInstance', back_populates='steps')


class SagaCompensation(Base):
    __tablename__ = 'sagacompensation'

    compensation_id = Column(String, primary_key=True, index=True)
    saga_id = Column(String, ForeignKey('sagainstance.saga_id'), index=True, nullable=False)
    step_id = Column(String, ForeignKey('sagastep.step_id'), index=True, nullable=False)
    action = Column(String, nullable=False)  # revoke_pass, divert_bag, lock_gate, release_seat, flag_passport
    status = Column(String, nullable=False, default='pending')  # pending, completed, failed, skipped
    input_payload = Column(Text)
    output_payload = Column(Text)
    error_message = Column(Text)
    executed_at = Column(DateTime)

    saga = relationship('SagaInstance', back_populates='compensations')
    step = relationship('SagaStep')
