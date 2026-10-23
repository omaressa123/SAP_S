"""Tests for M2.8 LLM-Assisted Disruption Planner.

No LLM provider is configured in the test environment, so the deterministic
heuristic fallback is exercised. Model output is never trusted: every plan is
validated against deterministic business rules.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional
from sqlalchemy import text
from unittest.mock import patch

import jwt
import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine, Base
from app.main import app
from app.models.disruption import DisruptionProposal
from app.models.flights import Flight, Booking, Airline, Airport
from app.models.security import BoardingGate
from app.models.wayfinding import Zone
from app.models.devices import Equipment
from app.models.passenger import Passenger
from app.models.staff import Staff
from app.agents.registry import AgentRegistry
from app.agents.disruption_planner import (
    DisruptionPlanner, build_snapshot, validate_plan, _heuristic_generate,
    ALLOWED_AGENTS, CONSEQUENTIAL_ACTIONS,
)
from app.agents.base import AgentResult, AgentStatus
from app.config import settings


def _clean_disruption_tables():
    db = SessionLocal()
    try:
        for tbl in ["disruptionproposal"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _clean():
    _clean_disruption_tables()
    yield
    _clean_disruption_tables()


def _seed(db):
    # Idempotent: clear seed rows first so the test is order-independent.
    for tbl in ["booking", "flight", "boardinggate", "equipment", "zone",
                "airline", "airport", "passengers"]:
        db.execute(text(f"DELETE FROM {tbl}"))
    db.commit()

    db.add(Airport(airport_id=1, iata_code="DXB", city="Dubai", country_code="AE"))
    db.add(Airport(airport_id=2, iata_code="LHR", city="London", country_code="GB"))
    db.add(Airline(airline_id=1, name="TestAir", iata_code="TX"))
    db.add(Zone(zone_id=1, zone_name="Terminal 1", terminal="T1", capacity=1000, current_occupancy=100))
    db.add(Equipment(equipment_id=1, equipment_type="gate", label="GATE-1", serial_number="GW-1",
                     zone_id=1, status="OPEN"))
    db.add(Equipment(equipment_id=2, equipment_type="gate", label="GATE-2", serial_number="GW-2",
                     zone_id=1, status="OPEN"))
    g1 = BoardingGate(boarding_gate_id=1, gate_number="A1", zone_id=1, equipment_id=1, status="OPEN")
    g2 = BoardingGate(boarding_gate_id=2, gate_number="A2", zone_id=1, equipment_id=2, status="OPEN")
    db.add_all([g1, g2])
    db.add(Flight(flight_id=1, flight_number="TX-101", airline_id=1,
                  origin_airport_id=1, destination_airport_id=2,
                  scheduled_departure=datetime.now(timezone.utc) + timedelta(hours=2),
                  status="SCHEDULED", boarding_gate_id=1))
    db.add(Flight(flight_id=2, flight_number="TX-102", airline_id=1,
                  origin_airport_id=1, destination_airport_id=2,
                  scheduled_departure=datetime.now(timezone.utc) + timedelta(hours=3),
                  status="SCHEDULED", boarding_gate_id=2))
    db.add(Booking(booking_id=1, passenger_id=1, flight_id=1,
                   booking_reference="REF1", seat_number="1A", booking_status="CONFIRMED"))
    db.add(Passenger(id=1, first_name="John", last_name="Doe",
                     passport_number="P1234567", biometric_registered=True))
    db.commit()


class FakeAgent:
    def __init__(self, agent_id, result=None):
        self.agent_id = agent_id
        self.name = agent_id
        self.status = AgentStatus.ACTIVE
        self.result = result or AgentResult(success=True, data={"ok": True})
        self.calls = []
    def is_healthy(self): return True
    def activate(self): self.status = AgentStatus.ACTIVE
    def deactivate(self): self.status = AgentStatus.INACTIVE
    def heartbeat(self): pass
    def set_error(self): self.status = AgentStatus.ERROR
    async def handle_event(self, event): return self.result
    async def execute_with_guard(self, event_type, payload, timeout_seconds=None):
        self.calls.append((event_type, payload))
        return self.result
    def validate_input(self, payload): return True
    def has_capability(self, name): return True
    def to_registry_entry(self): return {"agent_id": self.agent_id}


def _new_planner(registry=None):
    if registry is None:
        registry = AgentRegistry()
    return DisruptionPlanner(session_factory=SessionLocal, registry=registry)


def _staff_token(staff_id: int, role: str = "staff") -> str:
    return jwt.encode(
        {"sub": f"staff-{staff_id}", "role": role, "staff_id": staff_id},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )


# ------------------------------------------------------------------ snapshot

def test_build_snapshot_uses_real_data():
    db = SessionLocal()
    try:
        _seed(db)
        snap = build_snapshot(db)
        assert snap["flight_count"] == 2
        assert snap["gate_count"] == 2
        assert snap["flights"][0]["flight_number"] == "TX-101"
        assert snap["gates"][0]["gate_number"] == "A1"
    finally:
        db.close()


# ------------------------------------------------------------------ heuristic generation

def test_heuristic_generates_delay_actions():
    db = SessionLocal()
    try:
        _seed(db)
        snap = build_snapshot(db)
        actions = _heuristic_generate(snap, "weather", "high", "Storm on approach")
        agents = {a["agent"] for a in actions}
        caps = {a["capability"] for a in actions}
        assert "flight_ops_agent" in agents
        assert "propagate_delay" in caps
        # Every delay action has a valid delay.
        for a in actions:
            if a["capability"] == "propagate_delay":
                assert a["parameters"]["delay_minutes"] > 0
    finally:
        db.close()


# ------------------------------------------------------------------ validation

def test_validation_rejects_unknown_agent():
    db = SessionLocal()
    try:
        _seed(db)
        snap = build_snapshot(db)
        res = validate_plan(snap, [{"agent": "unknown_agent", "capability": "do_x", "parameters": {}}])
        assert res.passed is False
        assert any("unknown agent" in v for v in res.violations)
    finally:
        db.close()


def test_validation_rejects_gate_conflict():
    db = SessionLocal()
    try:
        _seed(db)
        snap = build_snapshot(db)
        # Assign both flights to the same gate -> conflict.
        actions = [
            {"agent": "flight_ops_agent", "capability": "assign_gate",
             "parameters": {"flight_id": 1, "gate_id": 1}},
            {"agent": "flight_ops_agent", "capability": "assign_gate",
             "parameters": {"flight_id": 2, "gate_id": 1}},
        ]
        res = validate_plan(snap, actions)
        assert res.passed is False
        assert any("already assigned" in v for v in res.violations)
    finally:
        db.close()


def test_validation_rejects_missing_params():
    db = SessionLocal()
    try:
        _seed(db)
        snap = build_snapshot(db)
        res = validate_plan(snap, [{"agent": "flight_ops_agent", "capability": "propagate_delay",
                                    "parameters": {"flight_id": 1}}])
        assert res.passed is False
        assert any("delay_minutes" in v for v in res.violations)
    finally:
        db.close()


# ------------------------------------------------------------------ generate proposal

def test_generate_proposal_uses_heuristic_when_no_llm():
    db = SessionLocal()
    try:
        _seed(db)
        planner = _new_planner()
        prop = planner.generate_proposal(
            scenario_id="scen-1", scenario_type="weather", severity="high",
            root_cause="Storm on approach", created_by="system",
        )
        assert prop["proposal_id"].startswith("prop_")
        assert prop["scenario_id"] == "scen-1"
        assert prop["status"] in ("validated", "rejected")
        assert isinstance(prop["actions"], list)
        assert len(prop["actions"]) >= 1
    finally:
        db.close()


def test_generate_proposal_rejects_invalid_plan():
    db = SessionLocal()
    try:
        _seed(db)
        planner = _new_planner()
        # Force an invalid action by monkeypatching _heuristic_generate.
        import app.agents.disruption_planner as dp
        orig = dp._heuristic_generate
        dp._heuristic_generate = lambda *a, **k: [{"agent": "unknown_agent", "capability": "x", "parameters": {}}]
        try:
            prop = planner.generate_proposal(
                scenario_id="scen-2", scenario_type="weather", severity="medium",
                root_cause="test", created_by="system",
            )
        finally:
            dp._heuristic_generate = orig
        assert prop["status"] == "rejected"
        assert prop["error_message"] is not None
    finally:
        db.close()


# ------------------------------------------------------------------ approve / execute / reject

def _make_staff(db, staff_id):
    db.add(Staff(staff_id=staff_id, full_name=f"Officer {staff_id}", department_id=1,
                 job_title="Officer", employment_type="staff", shift="A",
                 contact="x", hire_date=datetime.now(timezone.utc).date(),
                 is_active=True))
    db.commit()


def test_approve_and_execute_proposal():
    db = SessionLocal()
    try:
        _seed(db)
        _make_staff(db, 1)
        registry = AgentRegistry()
        registry.register(FakeAgent("flight_ops_agent"))
        registry.register(FakeAgent("notification_agent"))
        planner = DisruptionPlanner(session_factory=SessionLocal, registry=registry)

        prop = planner.generate_proposal(
            scenario_id="scen-3", scenario_type="weather", severity="medium",
            root_cause="Test storm", created_by="system",
        )
        assert prop["status"] == "validated"

        # Approve requires staff.
        approved = planner.approve_proposal(prop["proposal_id"], staff_id=1,
                                            reason="Looks reasonable")
        assert approved["status"] == "approved"
        assert approved["approved_by"] == 1

        # Execute.
        executed = planner.execute_proposal(prop["proposal_id"])
        assert executed["status"] in ("executed", "failed")
        assert executed["execution_result"] is not None
    finally:
        db.close()


def test_approve_rejects_unauthorized_staff():
    db = SessionLocal()
    try:
        _seed(db)
        planner = _new_planner()
        prop = planner.generate_proposal(
            scenario_id="scen-4", scenario_type="weather", severity="medium",
            root_cause="Test", created_by="system",
        )
        # staff_id 99 does not exist.
        res = planner.approve_proposal(prop["proposal_id"], staff_id=99, reason="x")
        assert res is None
    finally:
        db.close()


def test_reject_proposal():
    db = SessionLocal()
    try:
        _seed(db)
        _make_staff(db, 1)
        planner = _new_planner()
        prop = planner.generate_proposal(
            scenario_id="scen-5", scenario_type="weather", severity="medium",
            root_cause="Test", created_by="system",
        )
        rejected = planner.reject_proposal(prop["proposal_id"], staff_id=1, reason="Not safe")
        assert rejected["status"] == "rejected"
        got = planner.get_proposal(prop["proposal_id"])
        assert got["status"] == "rejected"
    finally:
        db.close()


def test_list_and_get_proposal():
    db = SessionLocal()
    try:
        _seed(db)
        planner = _new_planner()
        p1 = planner.generate_proposal(scenario_id="s1", scenario_type="weather",
                                       severity="low", root_cause="r", created_by="sys")
        p2 = planner.generate_proposal(scenario_id="s2", scenario_type="runway_closure",
                                       severity="critical", root_cause="r", created_by="sys")
        all_plans = planner.list_proposals()
        ids = {p["proposal_id"] for p in all_plans}
        assert p1["proposal_id"] in ids and p2["proposal_id"] in ids
        got = planner.get_proposal(p1["proposal_id"])
        assert got["scenario_id"] == "s1"
    finally:
        db.close()


# ------------------------------------------------------------------ controller API

@pytest.fixture
def client():
    return TestClient(app)


def test_controller_generate_and_approve(client):
    db = SessionLocal()
    try:
        _seed(db)
        _make_staff(db, 1)
    finally:
        db.close()
    token = _staff_token(1, "staff")

    resp = client.post("/api/v1/agents/disruption/plan", json={
        "scenario_id": "ctrl-1", "scenario_type": "weather", "severity": "high",
        "root_cause": "Severe storm",
    }, headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200, resp.text
    prop = resp.json()["data"]
    pid = prop["proposal_id"]
    assert prop["status"] in ("validated", "rejected")

    # Get detail.
    resp = client.get(f"/api/v1/agents/disruption/plan/{pid}", headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200
    assert resp.json()["data"]["proposal_id"] == pid

    # List.
    resp = client.get("/api/v1/agents/disruption/plans", headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1

    # Approve (staff).
    if prop["status"] == "validated":
        resp = client.post(f"/api/v1/agents/disruption/plan/{pid}/approve",
                           json={"reason": "Approved for test"},
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["status"] == "approved"
        # Execute.
        resp = client.post(f"/api/v1/agents/disruption/plan/{pid}/execute",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["data"]["status"] in ("executed", "failed")


def test_controller_approve_requires_staff(client):
    db = SessionLocal()
    try:
        _seed(db)
    finally:
        db.close()
    token = _staff_token(1, "passenger")  # not staff
    resp = client.post("/api/v1/agents/disruption/plan/nonexistent/approve",
                       json={"reason": "x"},
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
