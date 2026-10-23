"""Human-in-the-Loop (HITL) review request model.

A review request is created when an agent workflow (e.g. a passenger journey
Saga step) halts because it requires human judgement (ambiguous identity match,
unclear baggage threat, etc.). The request is persisted so it survives
WebSocket disconnects and application restarts; a timeout never silently
approves an uncertain decision.

States: pending -> {approved, rejected, expired, escalated}.
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, DECIMAL
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from decimal import Decimal
from ..database import Base


class HitlReview(Base):
    __tablename__ = 'hitlreview'

    review_id = Column(String, primary_key=True, index=True)
    saga_id = Column(String, index=True)  # linked workflow/saga, if any
    step_name = Column(String, index=True)  # journey step awaiting review
    agent_id = Column(String, index=True)  # agent that requested the review
    event_id = Column(String, index=True)  # originating event, if any
    correlation_id = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default='pending')  # pending, approved, rejected, expired, escalated
    evidence = Column(Text)  # JSON evidence presented to the reviewer
    confidence = Column(DECIMAL(5, 2))  # agent confidence that triggered review
    requested_reason = Column(Text)  # why review was requested
    decided_by = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    decided_at = Column(DateTime)
    decision_reason = Column(Text)  # reviewer's reason (required for sensitive overrides)
    expires_at = Column(DateTime, index=True)  # when the review times out
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Review escalation target staff (for expired -> escalated routing)
    escalated_to = Column(Integer, ForeignKey('staff.staff_id'), index=True)

    decider = relationship('Staff', foreign_keys=[decided_by])
    escalation_target = relationship('Staff', foreign_keys=[escalated_to])
