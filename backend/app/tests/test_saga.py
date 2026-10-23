"""Tests for M2.5 Persistent Passenger Journey Saga.

Uses the isolated SQLite test database (conftest). Agent behavior is
stubbed with fake agents so the saga engine (persistence, transitions,
compensation, retry, idempotency, resume) is tested in isolation.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import pytest
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models.saga import SagaInstance, SagaStep, SagaCompensation
from app.agents.registry import AgentRegistry
from app.agents.events import EventSystem
from app.agents.saga import (
    SagaWorkflowEngine,
    SagaStatus,
    StepStatus,
    JOURNEY_STEPS,
    LEGAL_TRANSITIONS,
    ALL_STATUSES,
)
from app.agents.base import AgentInterface, AgentResult, AgentStatus


class FakeAgent(AgentInterface):
    """Configurable fake agent for isolating saga behavior."""

    def __init__(self, agent_id: str, capability: str, event_type: str,
                 result: AgentResult, fail_with: Optional[str] = None,
                 service_unavailable: bool = False):
        super().__init__(agent_id=agent_id, name=agent_id)
        self.status = AgentStatus.ACTIVE
        self.capability = capability
        self.event_type = event_type
        self._result = result
        self.fail_with = fail_with
        self.service_unavailable = service_unavailable
        self.calls = 0
        self.register_capability(type("Cap", (), {
            "name": capability, "description": "", "input_schema": {},
            "output_schema": {}, "requires_human_review": False,
            "timeout_seconds": 300,
        })())
        self.register_handler(event_type, self._handle)

    def is_healthy(self):
        return self.status == AgentStatus.ACTIVE

    async def _handle(self, payload):
        self.calls += 1
        if self.fail_with:
            raise RuntimeError(self.fail_with)
        if self.service_unavailable:
            return AgentResult(success=False, error="service down",
                               service_unavailable=True)
        return self._result

    async def handle_event(self, event):
        return await self._handle(event.payload)

    def validate_input(self, payload):
        return isinstance(payload, dict)


def _result(success=True, decision="verified", confidence=0.95, review=False):
    return AgentResult(success=success, data={"decision": decision},
                       confidence=confidence, requires_human_review=review)


def _new_engine():
    registry = AgentRegistry()
    event_system = EventSystem(db_session_factory=SessionLocal)
    engine = SagaWorkflowEngine(registry=registry, event_system=event_system)
    return registry, event_system, engine


def _register_fake(registry, agent_id, capability, event_type, result, **kw):
    agent = FakeAgent(agent_id, capability, event_type, result, **kw)
    registry.register(agent)
    return agent


def _clean_saga_tables():
    db = SessionLocal()
    try:
        for tbl in ["sagacompensation", "sagastep", "sagainstance"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _clean():
    _clean_saga_tables()
    yield
    _clean_saga_tables()


# ------------------------------------------------------------------ start / idempotency

def test_start_journey_creates_saga_and_steps():
    registry, _, engine = _new_engine()
    saga = engine.start_journey(correlation_id="corr-1", passenger_id=7,
                                booking_id=9, flight_id=3)
    assert saga.status == SagaStatus.RUNNING
    assert saga.saga_id.startswith("saga_")
    assert len(saga.steps) == 4
    names = [s.name for s in saga.steps]
    assert names == [s["name"] for s in JOURNEY_STEPS]
    for step in saga.steps:
        assert step.status == StepStatus.PENDING
        assert step.retry_count == 0

    db = SessionLocal()
    row = db.query(SagaInstance).filter(SagaInstance.saga_id == saga.saga_id).first()
    assert row is not None
    assert row.status == SagaStatus.RUNNING
    assert row.correlation_id == "corr-1"
    db.close()


def test_start_journey_idempotent_same_correlation():
    registry, _, engine = _new_engine()
    s1 = engine.start_journey(correlation_id="corr-idem", passenger_id=1)
    s2 = engine.start_journey(correlation_id="corr-idem", passenger_id=99)
    assert s1.saga_id == s2.saga_id
    db = SessionLocal()
    count = db.query(SagaInstance).filter(
        SagaInstance.correlation_id == "corr-idem").count()
    db.close()
    assert count == 1


# ------------------------------------------------------------------ happy path

def test_happy_path_all_steps_complete():
    registry, _, engine = _new_engine()
    for name, agent_id, cap, et in [
        ("identity_verification", "identity_agent", "verify_identity", "face_verify"),
        ("baggage_screening", "baggage_agent", "screen_baggage", "baggage_scan"),
        ("security_clearance", "safety_agent", "assess_safety", "restricted_area"),
        ("boarding", "flight_ops_agent", "update_flight_status", "turnaround_milestone"),
    ]:
        _register_fake(registry, agent_id, cap, et, _result())

    saga = engine.start_journey(correlation_id="corr-happy", passenger_id=1,
                                flight_id=5)
    asyncio.run(engine._execute(saga))
    saga = engine.get_saga(saga.saga_id)
    assert saga["status"] == SagaStatus.COMPLETED
    assert all(s["status"] == StepStatus.COMPLETED for s in saga["steps"])
    assert saga["current_step_index"] == 4


# ------------------------------------------------------------------ step failure + compensation

def test_step_failure_triggers_compensation_of_completed_steps():
    registry, _, engine = _new_engine()
    # Step 0 succeeds; step 1 (baggage) fails; step 2,3 never run.
    reg = registry
    _register_fake(reg, "identity_agent", "verify_identity", "face_verify", _result())
    _register_fake(reg, "baggage_agent", "screen_baggage", "baggage_scan",
                   _result(success=False, decision="rejected", confidence=0.0),
                   fail_with="btd down")
    _register_fake(reg, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(reg, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-fail", passenger_id=2, flight_id=6)
    saga_id = saga.saga_id
    asyncio.run(engine._execute(saga))
    saga = engine.get_saga(saga_id)

    # Step 0 completed then compensated; step 1 failed; overall saga compensated.
    assert saga["status"] == SagaStatus.COMPENSATED
    steps = {s["name"]: s for s in saga["steps"]}
    assert steps["identity_verification"]["status"] == StepStatus.COMPLETED
    assert steps["baggage_screening"]["status"] == StepStatus.FAILED
    assert steps["security_clearance"]["status"] == StepStatus.PENDING
    assert steps["boarding"]["status"] == StepStatus.PENDING

    # Compensation recorded for the completed identity step.
    comps = saga["compensations"]
    actions = {c["action"] for c in comps}
    assert "revoke_pass" in actions
    assert "flag_passport" in actions
    # flag_passport has no automated capability -> skipped, not silently completed.
    fp = [c for c in comps if c["action"] == "flag_passport"][0]
    assert fp["status"] == "skipped"
    assert "manual intervention" in fp["error_message"]


# ------------------------------------------------------------------ retry / service unavailable then recovery

def test_retry_then_success():
    registry, _, engine = _new_engine()
    calls = {"n": 0}

    async def flaky(payload):
        calls["n"] += 1
        if calls["n"] < 3:
            return AgentResult(success=False, error="transient", service_unavailable=True)
        return _result()

    agent = FakeAgent("baggage_agent", "screen_baggage", "baggage_scan", _result())
    # Override handler to be flaky.
    agent.register_handler("baggage_scan", flaky)
    registry.register(agent)

    _register_fake(registry, "identity_agent", "verify_identity", "face_verify", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-retry", passenger_id=3, flight_id=7)
    asyncio.run(engine._execute(saga))
    saga = engine.get_saga(saga.saga_id)
    assert saga["status"] == SagaStatus.COMPLETED
    bag_step = [s for s in saga["steps"] if s["name"] == "baggage_screening"][0]
    assert bag_step["retry_count"] == 2


def test_service_unavailable_exhausted_then_fail_no_false_safe():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify",
                   _result(), service_unavailable=True)
    _register_fake(registry, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-exhaust", passenger_id=4, flight_id=8)
    asyncio.run(engine._execute(saga))
    saga = engine.get_saga(saga.saga_id)
    assert saga["status"] == SagaStatus.FAILED
    steps = {s["name"]: s for s in saga["steps"]}
    assert steps["identity_verification"]["status"] == StepStatus.FAILED
    assert "service down" in steps["identity_verification"]["error_message"]


# ------------------------------------------------------------------ human review (HITL hook)

def test_human_review_pause_approve_resume():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify",
                   _result(review=True))  # requires human review
    _register_fake(registry, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-hitl", passenger_id=5, flight_id=9)
    saga_id = saga.saga_id
    asyncio.run(engine._execute(saga))
    saga = engine.get_saga(saga_id)
    assert saga["status"] == SagaStatus.HUMAN_REVIEW_REQUIRED
    id_step = [s for s in saga["steps"] if s["name"] == "identity_verification"][0]
    assert id_step["status"] == StepStatus.NEEDS_REVIEW

    # Approve -> resumes and completes.
    updated = engine.approve_step(saga_id, "identity_verification", staff_id=1,
                                  reason="face match confirmed")
    assert updated["status"] == SagaStatus.COMPLETED
    steps = {s["name"]: s for s in updated["steps"]}
    assert steps["identity_verification"]["status"] == StepStatus.COMPLETED


def test_human_review_reject_compensates():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify", _result(review=True))
    _register_fake(registry, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-hitl-rej", passenger_id=6, flight_id=10)
    asyncio.run(engine._execute(saga))
    engine.reject_step(saga.saga_id, "identity_verification", staff_id=2,
                       reason="impostor detected")
    saga = engine.get_saga(saga.saga_id)
    # Nothing was completed before the rejection, so nothing to compensate;
    # the saga ends in FAILED with the rejected step recorded.
    assert saga["status"] == SagaStatus.FAILED
    steps = {s["name"]: s for s in saga["steps"]}
    assert steps["identity_verification"]["status"] == StepStatus.FAILED


# ------------------------------------------------------------------ resume after restart (new engine instance, same DB)

def test_resume_after_restart_continues_from_pending_step():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify", _result())
    _register_fake(registry, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    saga = engine.start_journey(correlation_id="corr-restart", passenger_id=8, flight_id=11)
    saga_id = saga.saga_id
    assert saga.status == SagaStatus.RUNNING
    assert all(s.status == StepStatus.PENDING for s in saga.steps)

    # Simulate restart: brand-new engine instance loads persisted state and runs it.
    registry2, _, engine2 = _new_engine()
    _register_fake(registry2, "identity_agent", "verify_identity", "face_verify", _result())
    _register_fake(registry2, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry2, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry2, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    resumed = engine2.resume_saga(saga_id)
    assert resumed is not None
    assert resumed.status == SagaStatus.COMPLETED
    got = engine2.get_saga(saga_id)
    assert got["status"] == SagaStatus.COMPLETED


def test_cancel_without_completed_steps():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify", _result())
    _register_fake(registry, "baggage_agent", "screen_baggage", "baggage_scan", _result())
    _register_fake(registry, "safety_agent", "assess_safety", "restricted_area", _result())
    _register_fake(registry, "flight_ops_agent", "update_flight_status", "turnaround_milestone", _result())

    fresh = engine.start_journey(correlation_id="corr-cancel", passenger_id=11, flight_id=14)
    cancelled = engine.cancel_saga(fresh.saga_id)
    assert cancelled.status == SagaStatus.CANCELLED
    got = engine.get_saga(fresh.saga_id)
    assert got["status"] == SagaStatus.CANCELLED


def test_legal_transitions_defined():
    for st in ALL_STATUSES:
        assert st in LEGAL_TRANSITIONS
    assert SagaStatus.COMPLETED in LEGAL_TRANSITIONS[SagaStatus.RUNNING]
    assert SagaStatus.FAILED in LEGAL_TRANSITIONS[SagaStatus.RUNNING]
    assert SagaStatus.HUMAN_REVIEW_REQUIRED in LEGAL_TRANSITIONS[SagaStatus.RUNNING]


def test_get_by_correlation_and_list():
    registry, _, engine = _new_engine()
    _register_fake(registry, "identity_agent", "verify_identity", "face_verify", _result())
    saga = engine.start_journey(correlation_id="corr-query", passenger_id=9, flight_id=12)
    got = engine.get_saga_by_correlation("corr-query")
    assert got is not None and got["saga_id"] == saga.saga_id
    assert engine.get_saga_by_correlation("no-such-corr") is None
    all_sagas = engine.list_sagas()
    assert any(s["saga_id"] == saga.saga_id for s in all_sagas)

