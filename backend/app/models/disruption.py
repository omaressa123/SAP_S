"""Disruption recovery proposal models (M2.8).

Tables:
  - disruptionproposal: one row per disruption-recovery proposal, with the
    proposed actions, validation outcome, approval, execution result and
    failure details.

Persisted in the existing PostgreSQL database. No new infrastructure.
"""
from __future__ import annotations

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class DisruptionProposal(Base):
    __tablename__ = 'disruptionproposal'

    proposal_id = Column(String, primary_key=True, index=True)
    scenario_id = Column(String, index=True, nullable=False)
    scenario_type = Column(String, nullable=False)  # weather, runway_closure, ground_stop, etc.
    severity = Column(String, nullable=False)  # low, medium, high, critical
    root_cause = Column(Text)
    status = Column(String, nullable=False, default='proposed')  # proposed, validated, approved, rejected, executed, failed
    created_by = Column(String, index=True)  # agent/system that generated it
    approved_by = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    approved_at = Column(DateTime)
    executed_at = Column(DateTime)
    expires_at = Column(DateTime)

    # The full plan: operational snapshot, proposed actions, validation result.
    snapshot = Column(Text)  # JSON operational snapshot
    actions = Column(Text)  # JSON list of {agent, capability, parameters}
    validation_result = Column(Text)  # JSON {passed, violations, rules_checked}
    execution_result = Column(Text)  # JSON per-action execution results
    error_message = Column(Text)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    approver = relationship('Staff', foreign_keys=[approved_by])
