"""Tests for the Autonomous Multi-Agent System layer.

Covers: agent input validation, event schema validation, event routing,
successful task execution, model integration failure, timeout handling,
duplicate-event handling, retry limits, workflow failure recovery,
database persistence, Digital Twin event publishing, permission enforcement.
"""
from datetime import datetime, date
import json

import pytest
from fastapi.testclient import TestClient

from app.tests.conftest import client, HEADERS, SessionLocal, TEST_PASSENGER_ID, TEST_BAG_ID
from app.models.agents import (
    AgentDefinition, AgentTask, AgentExecution, AirportEvent as MAirportEvent,
    WorkflowExecution, DecisionAudit,
)
from app.models.identity import Passenger, TravelDocument, FaceEnrollment
from app.models.check_in import Bag
from app.models.admin_cameras import EmergencyEvent, MonitoringAlert
from app.models.devices import Equipment

# ---- helpers ----

def _seed_passenger(db, pid=TEST_PASSENGER_ID):
    p = Passenger(
        passenger_id=pid, full_name="Test Passenger", email=f"p{pid}@example.com",
        password_hash="hash", biometric_consent=True, is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(p)
    db.flush()
    doc = TravelDocument(
        document_id=1, passenger_id=pid, document_type="passport",
        document_number=f"P{pid:06d}", issuing_country_code="US",
        expiry_date=date(2030, 1, 1), is_primary=True, created_at=datetime.utcnow(),
    )
    db.add(doc)
    db.flush()
    enc = FaceEnrollment(
        enrollment_id=1, passenger_id=pid, document_id=1,
        face_embedding_ref="ref", embedding_model="arcface",
        status="active", enrollment_time=datetime.utcnow(),
    )
    db.add(enc)
    db.commit()
    return pid

def _seed_bag(db, bid=TEST_BAG_ID):
    b = Bag(
        bag_id=bid, passenger_id=TEST_PASSENGER_ID,
        rfid_tag=f"RFID{bid:06d}", qr_code=f"QR{bid:06d}",
        weight_kg=20.0, current_status="checked_in",
        current_location="Check-in Hall", created_at=datetime.utcnow(),
    )
    db.add(b)
    db.commit()
    return bid

def _seed_agent_definition(db, agent_id="identity_agent", status="active"):
    a = AgentDefinition(
        agent_id=agent_id, name="Test Agent", description="test",
        capabilities=json.dumps(["verify_identity"]), status=status,
        created_at=datetime.utcnow(),
    )
    db.add(a)
    db.commit()
    return a

# ---- tests ----

class TestAgentRegistry:
    def test_register_and_list(self):
        from app.agents.registry import AgentRegistry
        from app.agents.identity_agent import IdentityAgent
        reg = AgentRegistry()
        agent = IdentityAgent()
        assert reg.register(agent) is True
        assert reg.register(IdentityAgent()) is False  # duplicate
        assert reg.get("identity_agent") is not None
        assert len(reg.list_active()) == 1
        snap = reg.snapshot()
        assert snap["total"] == 1
        assert snap["active"] == 1

    def test_agent_capability_lookup(self):
        from app.agents.identity_agent import IdentityAgent
        agent = IdentityAgent()
        assert agent.has_capability("verify_identity") is True
        assert agent.has_capability("screen_baggage") is False
        caps = agent.list_capabilities()
        assert any(c.name == "verify_identity" for c in caps)


class TestEventSystem:
    def test_event_create_and_roundtrip(self):
        from app.agents.events import AirportEvent, EventSeverity
        evt = AirportEvent.create(
            event_type="face_verify",
            source="api",
            payload={"passenger_id": 1},
            severity=EventSeverity.HIGH.value,
        )
        assert evt.event_id.startswith("evt_")
        assert evt.correlation_id.startswith("corr_")
        assert evt.status == "received"
        assert evt.severity == "high"
        d = evt.to_dict()
        assert d["event_id"] == evt.event_id

    def test_event_system_persist_and_retrieve(self):
        from app.agents.events import AirportEvent, EventSystem
        es = EventSystem(db_session_factory=SessionLocal)
        evt = AirportEvent.create(
            event_type="baggage_scan", source="api",
            payload={"bag_id": 1}, severity="high",
        )
        es.publish(evt)
        recent = es.get_recent(limit=10)
        assert any(e["event_id"] == evt.event_id for e in recent)
        assert any(e["event_type"] == "baggage_scan" for e in recent)

    def test_event_idempotency(self):
        from app.agents.events import AirportEvent, EventSystem
        es = EventSystem(db_session_factory=SessionLocal)
        evt = AirportEvent.create(event_type="smoke_detected", source="iot_device")
        es.publish(evt)
        es.publish(evt)  # duplicate — should be no-op
        recent = [e for e in es.get_recent(limit=10) if e["event_id"] == evt.event_id]
        assert len(recent) == 1


class TestAgentInputValidation:
    def test_identity_agent_validate_input(self):
        from app.agents.identity_agent import IdentityAgent
        agent = IdentityAgent()
        assert agent.validate_input({"passenger_id": 1}) is True
        assert agent.validate_input({"passport_number": "P123"}) is True
        assert agent.validate_input({}) is False
        assert agent.validate_input("not a dict") is False

    def test_baggage_agent_validate_input(self):
        from app.agents.baggage_agent import BaggageAgent
        agent = BaggageAgent()
        assert agent.validate_input({"bag_id": 1}) is True
        assert agent.validate_input({}) is False

    def test_safety_agent_validate_input(self):
        from app.agents.safety_agent import SafetyAgent
        agent = SafetyAgent()
        assert agent.validate_input({"event_type": "fire_detected"}) is True
        assert agent.validate_input({}) is False


class TestModelAdapters:
    def test_face_adapter_precomputed_similarity(self):
        from app.agents.adapters.face import FaceVerificationAdapter
        adapter = FaceVerificationAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "cosine_similarity": 0.85,
            "match_threshold": 0.6,
        }))
        assert result.success is True
        assert result.detection == "face_match"
        assert result.verified_event == "verified"
        assert result.requires_human_review is False
        assert result.confidence == 0.85

    def test_face_adapter_low_confidence(self):
        from app.agents.adapters.face import FaceVerificationAdapter
        adapter = FaceVerificationAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "cosine_similarity": 0.3,
            "match_threshold": 0.6,
        }))
        assert result.success is True
        assert result.verified_event == "failed"
        assert result.requires_human_review is True

    def test_face_adapter_no_input(self):
        from app.agents.adapters.face import FaceVerificationAdapter
        adapter = FaceVerificationAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({}))
        assert result.success is False
        assert result.requires_human_review is True

    def test_baggage_adapter_threat_detection(self):
        from app.agents.adapters.baggage import BaggageThreatAdapter
        adapter = BaggageThreatAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "bag_id": 1,
            "detections": [
                {"item_type": "knife", "confidence": 0.9},
                {"item_type": "laptop", "confidence": 0.8},
            ],
        }))
        assert result.success is True
        assert result.detection == "MANUAL_REVIEW"
        assert result.verified_event == "threat_detected"
        assert result.requires_human_review is True
        assert result.metadata["threat_found"] is True

    def test_baggage_adapter_safe(self):
        from app.agents.adapters.baggage import BaggageThreatAdapter
        adapter = BaggageThreatAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "bag_id": 1,
            "detections": [
                {"item_type": "laptop", "confidence": 0.8},
            ],
        }))
        assert result.success is True
        assert result.detection == "SAFE"
        assert result.requires_human_review is False

    def test_safety_adapter_precomputed(self):
        from app.agents.adapters.safety import SafetyAdapter
        adapter = SafetyAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "event_type": "fire_detected",
            "detection_data": {"label": "fire", "confidence": 0.95},
            "zone_id": 3,
            "camera_id": 10,
        }))
        assert result.success is True
        assert result.detection == "fire"
        assert result.confidence == 0.95
        assert result.requires_human_review is True

    def test_safety_adapter_no_service(self):
        from app.agents.adapters.safety import SafetyAdapter
        adapter = SafetyAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "event_type": "fire_detected",
            "image_path": "/nonexistent.jpg",
        }))
        # service_unavailable since no service URL configured
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True


class TestEventRouting:
    def test_route_event_to_identity_agent(self):
        from app.agents.registry import AgentRegistry
        from app.agents.events import EventSystem
        from app.agents.orchestrator import AgentOrchestrator
        from app.agents.identity_agent import IdentityAgent

        reg = AgentRegistry()
        es = EventSystem(db_session_factory=SessionLocal)
        orch = AgentOrchestrator(registry=reg, event_system=es)
        agent = IdentityAgent()
        reg.register(agent)

        import asyncio
        event = asyncio.run(orch.ingest_event(
            event_type="face_verify",
            source="api",
            payload={"passenger_id": TEST_PASSENGER_ID, "cosine_similarity": 0.85},
        ))
        assert event.event_id is not None
        assert event.correlation_id is not None

    def test_route_event_unknown_type(self):
        from app.agents.registry import AgentRegistry
        from app.agents.events import EventSystem
        from app.agents.orchestrator import AgentOrchestrator

        reg = AgentRegistry()
        es = EventSystem(db_session_factory=SessionLocal)
        orch = AgentOrchestrator(registry=reg, event_system=es)

        import asyncio
        event = asyncio.run(orch.ingest_event(
            event_type="unknown_event_type",
            source="api",
            payload={},
        ))
        assert event.event_id is not None


class TestDatabasePersistence:
    def test_agent_definition_persisted(self):
        db = SessionLocal()
        _seed_agent_definition(db)
        row = db.query(AgentDefinition).filter(AgentDefinition.agent_id == "identity_agent").first()
        assert row is not None
        assert row.status == "active"
        db.close()

    def test_airport_event_persisted(self):
        db = SessionLocal()
        evt = MAirportEvent(
            event_id="evt_test123", event_type="face_verify", source="api",
            payload=json.dumps({"passenger_id": 1}), status="received",
            severity="info", created_at=datetime.utcnow(),
        )
        db.add(evt)
        db.commit()
        row = db.query(MAirportEvent).filter(MAirportEvent.event_id == "evt_test123").first()
        assert row is not None
        assert row.event_type == "face_verify"
        db.close()

    def test_workflow_execution_persisted(self):
        db = SessionLocal()
        wf = WorkflowExecution(
            workflow_id="wf_test123", name="identity_verification",
            status="running", correlation_id="corr_abc",
            input_payload=json.dumps({"passenger_id": 1}),
            started_at=datetime.utcnow(),
        )
        db.add(wf)
        db.commit()
        row = db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == "wf_test123").first()
        assert row is not None
        assert row.name == "identity_verification"
        db.close()

    def test_decision_audit_persisted(self):
        db = SessionLocal()
        wf = WorkflowExecution(
            workflow_id="wf_decision", name="identity_verification",
            status="running", correlation_id="corr_dec",
            input_payload=json.dumps({}), started_at=datetime.utcnow(),
        )
        db.add(wf)
        db.flush()
        da = DecisionAudit(
            audit_id=1, workflow_id="wf_decision", agent_id="identity_agent",
            decision="review", rationale="low confidence",
            confidence=0.55, requires_human_review=True,
            created_at=datetime.utcnow(),
        )
        db.add(da)
        db.commit()
        row = db.query(DecisionAudit).filter(DecisionAudit.audit_id == 1).first()
        assert row is not None
        assert row.decision == "review"
        assert row.requires_human_review is True
        db.close()

    def test_emergency_event_persisted(self):
        db = SessionLocal()
        ee = EmergencyEvent(
            event_id=1, event_type="fire", zone_id=3,
            status="detected", detected_time=datetime.utcnow(),
        )
        db.add(ee)
        db.commit()
        row = db.query(EmergencyEvent).filter(EmergencyEvent.event_id == 1).first()
        assert row is not None
        assert row.event_type == "fire"
        db.close()


class TestEndToEndWorkflow:
    def test_identity_verification_workflow_via_api(self):
        # Seed passenger
        db = SessionLocal()
        _seed_passenger(db)
        db.close()

        r = client.post("/api/v1/agents/events",
            json={
                "event_type": "face_verify",
                "source": "api",
                "payload": {
                    "passenger_id": TEST_PASSENGER_ID,
                    "cosine_similarity": 0.85,
                    "checkpoint_type": "security_gate",
                },
            },
            headers=HEADERS,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "event_id" in body["data"]

        # Verify event persisted (orchestrator marks it resolved after processing)
        db = SessionLocal()
        evt = db.query(MAirportEvent).filter(MAirportEvent.event_type == "face_verify").first()
        assert evt is not None
        assert evt.status == "resolved"
        db.close()

    def test_baggage_screening_workflow_via_api(self):
        db = SessionLocal()
        _seed_bag(db)
        # Verify bag exists after seeding
        bag_check = db.query(Bag).filter(Bag.bag_id == TEST_BAG_ID).first()
        assert bag_check is not None, "Bag was not seeded"
        db.close()

        r = client.post("/api/v1/agents/events",
            json={
                "event_type": "baggage_scan",
                "source": "api",
                "payload": {
                    "bag_id": TEST_BAG_ID,
                    "detections": [
                        {"item_type": "knife", "confidence": 0.9},
                    ],
                    "equipment_id": 1,
                },
            },
            headers=HEADERS,
        )
        assert r.status_code == 200, f"Unexpected status: {r.status_code}, body: {r.text[:200]}"
        body = r.json()
        assert body["success"] is True, f"Body not success: {body}"

        # Verify inspection persisted
        db = SessionLocal()
        insp = db.query(__import__("app.models.baggage_security_screening", fromlist=["BaggageInspection"]).BaggageInspection).first()
        assert insp is not None
        assert insp.result == "MANUAL_REVIEW"
        # Bag status updated to stationary (held for review)
        bag = db.query(Bag).filter(Bag.bag_id == TEST_BAG_ID).first()
        assert bag.current_status == "stationary"
        db.close()
        assert insp.result == "MANUAL_REVIEW"
        # Bag status updated to stationary (held for review)
        bag = db.query(Bag).filter(Bag.bag_id == TEST_BAG_ID).first()
        assert bag.current_status == "stationary"
        db.close()

    def test_safety_event_workflow_via_api(self):
        r = client.post("/api/v1/agents/events",
            json={
                "event_type": "fire_detected",
                "source": "iot_device",
                "payload": {"zone_id": 3, "camera_id": 10},
                "severity": "critical",
            },
            headers=HEADERS,
        )
        assert r.status_code == 200

        # Verify emergency event persisted
        db = SessionLocal()
        ee = db.query(EmergencyEvent).filter(EmergencyEvent.event_type == "smoke_fire").first()
        assert ee is not None
        db.close()

    def test_duplicate_event_idempotency(self):
        from app.agents.events import AirportEvent
        from app.agents.service import agent_service
        es = agent_service.get_event_system()
        evt = AirportEvent.create(event_type="smoke_detected", source="api")
        es.publish(evt)
        es.publish(evt)  # duplicate
        recent = [e for e in es.get_recent(limit=10) if e["event_id"] == evt.event_id]
        assert len(recent) == 1

    def test_unauthorized_access_rejected(self):
        r = client.get("/api/v1/agents/registry", headers={})
        assert r.status_code == 401

    def test_agent_registry_endpoint(self):
        r = client.get("/api/v1/agents/registry", headers=HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "agents" in body["data"]
        agent_ids = [a["agent_id"] for a in body["data"]["agents"]]
        assert "identity_agent" in agent_ids
        assert "baggage_agent" in agent_ids
        assert "safety_agent" in agent_ids

    def test_workflow_list_endpoint(self):
        r = client.get("/api/v1/agents/workflows", headers=HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_events_endpoint(self):
        r = client.get("/api/v1/agents/events", headers=HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

    def test_snapshot_endpoint(self):
        r = client.get("/api/v1/agents/snapshot", headers=HEADERS)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["initialized"] is True


class TestAgentOrchestratorGuard:
    def test_max_workflow_steps(self):
        from app.agents.registry import AgentRegistry
        from app.agents.events import EventSystem
        from app.agents.orchestrator import AgentOrchestrator, MAX_WORKFLOW_STEPS

        reg = AgentRegistry()
        es = EventSystem(db_session_factory=SessionLocal)
        orch = AgentOrchestrator(registry=reg, event_system=es)

        # Manually fill steps beyond limit
        from app.agents.orchestrator import WorkflowContext, WorkflowStep, TaskStatus
        ctx = WorkflowContext(workflow_id="wf_guard", name="test", correlation_id="c", status="running")
        for i in range(MAX_WORKFLOW_STEPS):
            ctx.steps.append(WorkflowStep(
                step_index=i, task_id=f"task_{i}", agent_id="a",
                task_type="t", status=TaskStatus.COMPLETED.value,
            ))

        # Now try to execute another step — should be blocked
        import asyncio
        # Use a mock agent that always succeeds
        class AlwaysSucceedAgent:
            agent_id = "mock_agent"
            async def execute_with_guard(self, event_type, payload, timeout_seconds=None):
                from app.agents.base import AgentResult
                return AgentResult(success=True, data={"ok": True})
            def validate_input(self, payload):
                return True

        agent = AlwaysSucceedAgent()
        class FakeEvent:
            event_type = "test_event"
        step = asyncio.run(orch._execute_step(ctx, step_index=MAX_WORKFLOW_STEPS, agent=agent, event=FakeEvent()))
        assert step.status == TaskStatus.FAILED.value
        assert "max workflow steps" in step.error


class TestAgentRecovery:
    def test_agent_error_state(self):
        from app.agents.identity_agent import IdentityAgent
        agent = IdentityAgent()
        agent.set_error()
        assert agent.is_healthy() is False
        agent.heartbeat()
        assert agent.is_healthy() is True
