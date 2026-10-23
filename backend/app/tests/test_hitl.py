"""Tests for M2.7 Human-in-the-Loop (HITL) escalation.

Tests review persistence, decision authorization, duplicate/conflicting
decision prevention, safe expiry escalation, and saga resume/compensate
integration. Uses the isolated SQLite test database.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine, Base
from app.main import app
from app.models.hitl import HitlReview
from app.models.staff import Staff
from app.models.saga import SagaInstance, SagaStep
from app.agents.registry import AgentRegistry
from app.agents.events import EventSystem
from app.agents.hitl import HitlManager
from app.agents.saga import SagaWorkflowEngine, StepStatus, SagaStatus
from app.agents.base import AgentInterface, AgentResult, AgentStatus
from app.agents.service import agent_service
from app.config import settings


class FakeAgent(AgentInterface):
    def __init__(self, agent_id, capability, event_type, result=None):
        super().__init__(agent_id=agent_id, name=agent_id)
        self.status = AgentStatus.ACTIVE
        self.result = result or AgentResult(success=True, data={"ok": True})
        self.calls = []
        self.register_capability(type("C", (), {
            "name": capability, "description": "", "input_schema": {},
            "output_schema": {}, "requires_human_review": False,
            "timeout_seconds": 30,
        })())
        self.register_handler(event_type, self._handle)

    def is_healthy(self):
        return True

    async def _handle(self, payload):
        self.calls.append(payload)
        return self.result

    async def handle_event(self, event):
        return await self._handle(event.payload)

    def validate_input(self, payload):
        return isinstance(payload, dict)


def _result(success=True, decision="verified", review=False):
    return AgentResult(success=success, data={"decision": decision},
                       requires_human_review=review)


def _new_stack():
    registry = AgentRegistry()
    event_system = EventSystem(db_session_factory=SessionLocal)
    saga_engine = SagaWorkflowEngine(registry=registry, event_system=event_system)
    hitl = HitlManager(saga_engine=saga_engine)
    saga_engine.hitl_manager = hitl
    return registry, event_system, saga_engine, hitl


def _clean_hitl_tables():
    db = SessionLocal()
    try:
        for tbl in ["hitlreview"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _clean():
    _clean_hitl_tables()
    yield
    _clean_hitl_tables()


# ------------------------------------------------------------------ model / manager

def test_create_and_get_review():
    _, _, _, hitl = _new_stack()
    r = hitl.create_review(
        correlation_id="corr-1", step_name="identity_verification",
        agent_id="identity_agent", evidence={"similarity": 0.75},
        confidence=0.75, requested_reason="low face match",
        saga_id="saga-1", ttl_seconds=900,
    )
    assert r.review_id.startswith("hitl_")
    assert r.status == "pending"
    assert r.correlation_id == "corr-1"

    got = hitl.get_review(r.review_id)
    assert got is not None
    assert got["review_id"] == r.review_id
    assert got["status"] == "pending"
    assert got["evidence"]["similarity"] == 0.75


def test_list_pending_only_pending():
    _, _, _, hitl = _new_stack()
    r1 = hitl.create_review(correlation_id="c1", step_name="identity_verification",
                            agent_id="identity_agent", evidence={})
    r2 = hitl.create_review(correlation_id="c2", step_name="baggage_screening",
                            agent_id="baggage_agent", evidence={})
    pending = hitl.list_pending()
    ids = {x["review_id"] for x in pending}
    assert r1.review_id in ids and r2.review_id in ids

    # Approve r1 -> no longer pending.
    from app.models.staff import Staff
    db = SessionLocal()
    staff = Staff(staff_id=1, full_name="Officer", department_id=1,
                  job_title="Officer", employment_type="staff", shift="A",
                  contact="x", hire_date=datetime.now(timezone.utc).date(),
                  is_active=True)
    db.add(staff)
    db.commit()
    db.close()
    hitl.submit_decision(r1.review_id, decision="approve", staff_id=1, reason="ok")
    pending = hitl.list_pending()
    assert all(x["review_id"] != r1.review_id for x in pending)
    assert any(x["review_id"] == r2.review_id for x in pending)


def test_duplicate_decision_rejected():
    _, _, _, hitl = _new_stack()
    r = hitl.create_review(correlation_id="c1", step_name="identity_verification",
                           agent_id="identity_agent", evidence={})
    db = SessionLocal()
    staff = Staff(staff_id=1, full_name="Officer", department_id=1,
                  job_title="Officer", employment_type="staff", shift="A",
                  contact="x", hire_date=datetime.now(timezone.utc).date(),
                  is_active=True)
    db.add(staff)
    db.commit()
    db.close()

    hitl.submit_decision(r.review_id, decision="approve", staff_id=1, reason="first")
    again = hitl.submit_decision(r.review_id, decision="reject", staff_id=1, reason="second")
    assert again is None  # duplicate/conflicting decision is a no-op
    got = hitl.get_review(r.review_id)
    assert got["status"] == "approved"


def test_expire_reviews_escalates_never_approves():
    _, _, _, hitl = _new_stack()
    r = hitl.create_review(correlation_id="c1", step_name="identity_verification",
                           agent_id="identity_agent", evidence={},
                           ttl_seconds=1)
    # Force expiry in the past.
    db = SessionLocal()
    row = db.query(HitlReview).filter(HitlReview.review_id == r.review_id).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()
    db.close()

    escalated = hitl.expire_reviews()
    assert r.review_id in escalated
    got = hitl.get_review(r.review_id)
    assert got["status"] == "escalated"  # safe escalation, NOT approved


def test_decision_requires_reason():
    _, _, _, hitl = _new_stack()
    r = hitl.create_review(correlation_id="c1", step_name="identity_verification",
                           agent_id="identity_agent", evidence={})
    with pytest.raises(ValueError):
        hitl.submit_decision(r.review_id, decision="approve", staff_id=1, reason="")


# ------------------------------------------------------------------ saga resume / compensate integration

def test_hitl_approve_resumes_saga():
    registry, _, saga_engine, hitl = _new_stack()
    # Identity requires review; the rest succeed.
    registry.register(FakeAgent("identity_agent", "verify_identity", "face_verify",
                                _result(review=True)))
    registry.register(FakeAgent("baggage_agent", "screen_baggage", "baggage_scan",
                                _result()))
    registry.register(FakeAgent("safety_agent", "assess_safety", "restricted_area",
                                _result()))
    registry.register(FakeAgent("flight_ops_agent", "update_flight_status",
                                "turnaround_milestone", _result()))

    saga = saga_engine.start_journey(correlation_id="corr-hitl", passenger_id=1,
                                     flight_id=1)
    saga_id = saga.saga_id
    asyncio.run(saga_engine._execute(saga))
    saga = saga_engine.get_saga(saga_id)
    assert saga["status"] == SagaStatus.HUMAN_REVIEW_REQUIRED
    id_step = [s for s in saga["steps"] if s["name"] == "identity_verification"][0]
    assert id_step["status"] == StepStatus.NEEDS_REVIEW

    # A HITL review should have been auto-created.
    pending = hitl.list_pending()
    assert len(pending) == 1
    review_id = pending[0]["review_id"]
    assert pending[0]["saga_id"] == saga_id

    db = SessionLocal()
    staff = Staff(staff_id=1, full_name="Officer", department_id=1,
                  job_title="Officer", employment_type="staff", shift="A",
                  contact="x", hire_date=datetime.now(timezone.utc).date(),
                  is_active=True)
    db.add(staff)
    db.commit()
    db.close()

    # Approve -> saga resumes and completes.
    updated = hitl.submit_decision(review_id, decision="approve", staff_id=1,
                                   reason="face match confirmed manually")
    assert updated["saga_status"] == SagaStatus.COMPLETED
    saga = saga_engine.get_saga(saga_id)
    assert saga["status"] == SagaStatus.COMPLETED
    steps = {s["name"]: s for s in saga["steps"]}
    assert steps["identity_verification"]["status"] == StepStatus.COMPLETED


def test_hitl_reject_compensates_saga():
    registry, _, saga_engine, hitl = _new_stack()
    registry.register(FakeAgent("identity_agent", "verify_identity", "face_verify",
                                _result(review=True)))
    registry.register(FakeAgent("baggage_agent", "screen_baggage", "baggage_scan",
                                _result()))
    registry.register(FakeAgent("safety_agent", "assess_safety", "restricted_area",
                                _result()))
    registry.register(FakeAgent("flight_ops_agent", "update_flight_status",
                                "turnaround_milestone", _result()))

    saga = saga_engine.start_journey(correlation_id="corr-hitl-rej", passenger_id=2,
                                     flight_id=2)
    saga_id = saga.saga_id
    asyncio.run(saga_engine._execute(saga))
    saga = saga_engine.get_saga(saga_id)
    assert saga["status"] == SagaStatus.HUMAN_REVIEW_REQUIRED

    pending = hitl.list_pending()
    review_id = pending[0]["review_id"]

    db = SessionLocal()
    staff = Staff(staff_id=2, full_name="Officer2", department_id=1,
                  job_title="Officer", employment_type="staff", shift="B",
                  contact="x", hire_date=datetime.now(timezone.utc).date(),
                  is_active=True)
    db.add(staff)
    db.commit()
    db.close()

    updated = hitl.submit_decision(review_id, decision="reject", staff_id=2,
                                   reason="impostor detected")
    # Identity not yet completed -> nothing to compensate; saga FAILED.
    assert updated["saga_status"] == SagaStatus.FAILED
    saga = saga_engine.get_saga(saga_id)
    assert saga["status"] == SagaStatus.FAILED


# ------------------------------------------------------------------ controller API

@pytest.fixture
def client():
    return TestClient(app)


def _staff_token(staff_id: int, role: str = "staff") -> str:
    return jwt.encode(
        {"sub": f"staff-{staff_id}", "role": role, "staff_id": staff_id},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


def _add_staff(staff_id: int):
    db = SessionLocal()
    db.add(Staff(staff_id=staff_id, full_name=f"Officer {staff_id}", department_id=1,
                 job_title="Officer", employment_type="staff", shift="A",
                 contact="x", hire_date=datetime.now(timezone.utc).date(),
                 is_active=True))
    db.commit()
    db.close()


def test_controller_pending_and_decision(client):
    # Set up a saga that needs review via direct engine.
    registry, _, saga_engine, hitl = _new_stack()
    registry.register(FakeAgent("identity_agent", "verify_identity", "face_verify",
                                _result(review=True)))
    registry.register(FakeAgent("baggage_agent", "screen_baggage", "baggage_scan",
                                _result()))
    registry.register(FakeAgent("safety_agent", "assess_safety", "restricted_area",
                                _result()))
    registry.register(FakeAgent("flight_ops_agent", "update_flight_status",
                                "turnaround_milestone", _result()))
    saga = saga_engine.start_journey(correlation_id="corr-api", passenger_id=3,
                                     flight_id=3)
    asyncio.run(saga_engine._execute(saga))
    review_id = hitl.list_pending()[0]["review_id"]

    _add_staff(1)
    token = _staff_token(1, "staff")

    # List pending (authenticated staff).
    resp = client.get("/api/v1/agents/hitl/pending",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert any(x["review_id"] == review_id for x in resp.json()["data"])

    # Get review detail.
    resp = client.get(f"/api/v1/agents/hitl/reviews/{review_id}",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "pending"

    # Submit approve decision.
    resp = client.post(f"/api/v1/agents/hitl/reviews/{review_id}/decision",
                       json={"decision": "approve", "reason": "manual override"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "approved"

    # Duplicate decision rejected.
    resp = client.post(f"/api/v1/agents/hitl/reviews/{review_id}/decision",
                       json={"decision": "reject", "reason": "conflict"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404  # already decided


def test_controller_decision_rejects_non_staff(client):
    _add_staff(1)
    token = _staff_token(1, "passenger")  # passenger role, not staff
    resp = client.post("/api/v1/agents/hitl/reviews/fake-id/decision",
                       json={"decision": "approve", "reason": "x"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_controller_create_review(client):
    resp = client.post("/api/v1/agents/hitl/reviews", json={
        "correlation_id": "corr-create", "step_name": "identity_verification",
        "agent_id": "identity_agent", "evidence": {"similarity": 0.6},
        "confidence": 0.6, "requested_reason": "low match",
    }, headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "pending"
