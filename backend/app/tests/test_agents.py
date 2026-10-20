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
from app.models.check_in import Bag, BagCheckpointLog
from app.models.admin_cameras import EmergencyEvent, MonitoringAlert
from app.models.devices import Equipment
from app.models.baggage_security_screening import BaggageInspection, DetectedItem

# ---- helpers ----

def _seed_passenger(db, pid=TEST_PASSENGER_ID):
    # Idempotent: avoid PK clashes across tests (clean_tables doesn't clear seed tables).
    db.query(FaceEnrollment).filter(FaceEnrollment.passenger_id == pid).delete()
    db.query(TravelDocument).filter(TravelDocument.passenger_id == pid).delete()
    db.query(Passenger).filter(Passenger.passenger_id == pid).delete()
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
    # Idempotent: avoid PK clashes across tests (clean_tables doesn't clear seed tables).
    inspection_ids = [r[0] for r in db.query(BaggageInspection.inspection_id)
                      .filter(BaggageInspection.bag_id == bid).all()]
    if inspection_ids:
        db.query(DetectedItem).filter(
            DetectedItem.inspection_id.in_(inspection_ids)
        ).delete(synchronize_session=False)
    db.query(BaggageInspection).filter(BaggageInspection.bag_id == bid).delete(
        synchronize_session=False)
    db.query(BagCheckpointLog).filter(BagCheckpointLog.bag_id == bid).delete(
        synchronize_session=False)
    db.query(Bag).filter(Bag.bag_id == bid).delete(synchronize_session=False)
    db.commit()
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

    def test_baggage_adapter_safe_no_detections(self):
        """No detections -> SAFE (the only SAFE outcome)."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        adapter = BaggageThreatAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "bag_id": 1,
            "detections": [],
        }))
        assert result.success is True
        assert result.detection == "SAFE"
        assert result.verified_event == "no_items_detected"
        assert result.requires_human_review is False
        assert result.metadata["threat_found"] is False

    def test_baggage_adapter_any_detection_manual_review(self):
        """Any detection (known threat or unknown class) -> MANUAL_REVIEW.

        A model detection is a candidate requiring human review; it is never
        automatically SAFE. "laptop" is not even a BTD class, but an unknown
        detection must not become SAFE.
        """
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
        assert result.detection == "MANUAL_REVIEW"
        assert result.verified_event == "threat_detected"
        assert result.requires_human_review is True
        assert result.metadata["threat_found"] is True

    def test_baggage_adapter_real_btd_class(self):
        """A real BTD threat class (knife) -> MANUAL_REVIEW with preserved
        class name and confidence."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        adapter = BaggageThreatAdapter()
        import asyncio
        result = asyncio.run(adapter.infer({
            "bag_id": 1,
            "detections": [
                {"item_type": "knife", "confidence": 0.93},
            ],
        }))
        assert result.success is True
        assert result.detection == "MANUAL_REVIEW"
        assert result.confidence == 0.93
        assert result.metadata["detections"][0]["item_type"] == "knife"


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


class TestBaggageAdapterRealInference:
    """Tests for the BTD HTTP inference endpoint integration.

    These tests mock the HTTP layer (httpx.AsyncClient) because the YOLO11
    runtime (torch + ultralytics) is not installed in this environment, so
    the real model cannot be executed here. The adapter code path is the same
    one used against the real endpoint.
    """

    def _mock_httpx_response(self, status_code=200, json_body=None, exc=None):
        """Build a mock httpx AsyncClient context manager."""
        from unittest.mock import AsyncMock, MagicMock, patch

        mock_response = MagicMock()
        mock_response.status_code = status_code
        if json_body is not None:
            mock_response.json = MagicMock(return_value=json_body)
        else:
            mock_response.json = MagicMock(side_effect=ValueError("no json"))

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        if exc is not None:
            mock_client.post = AsyncMock(side_effect=exc)

        return patch("httpx.AsyncClient", return_value=mock_client)

    def test_real_inference_parse_detections(self, temp_image):
        """Real image upload → detections parsed → MANUAL_REVIEW."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        response_body = {
            "detections": [
                {"item_type": "knife", "confidence": 0.93, "box": [10, 20, 100, 200]},
                {"item_type": "gun", "confidence": 0.88, "box": [50, 60, 150, 250]},
            ],
            "detection_count": 2,
            "model": "best.pt",
        }
        with self._mock_httpx_response(json_body=response_body):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is True
        assert result.detection == "MANUAL_REVIEW"
        assert result.verified_event == "threat_detected"
        assert result.requires_human_review is True
        assert result.confidence == 0.93  # max confidence
        assert result.metadata["detection_count"] == 2
        assert result.metadata["threat_found"] is True
        types = [d["item_type"] for d in result.metadata["detections"]]
        assert "knife" in types and "gun" in types

    def test_real_inference_no_detections_safe(self, temp_image):
        """Real inference returns no detections -> SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        response_body = {"detections": [], "detection_count": 0, "model": "best.pt"}
        with self._mock_httpx_response(json_body=response_body):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is True
        assert result.detection == "SAFE"
        assert result.requires_human_review is False
        assert result.metadata["threat_found"] is False

    def test_real_inference_service_unavailable_not_safe(self, temp_image):
        """BTD service unreachable -> success=False, never SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio
        import httpx

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        with self._mock_httpx_response(exc=httpx.ConnectError("refused")):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True
        assert "unreachable" in result.error

    def test_real_inference_timeout_not_safe(self, temp_image):
        """BTD inference timeout -> success=False, never SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio
        import httpx

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        with self._mock_httpx_response(exc=httpx.TimeoutException("timed out")):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert "timed out" in result.error

    def test_real_inference_http_error_not_safe(self, temp_image):
        """BTD service HTTP error -> success=False, never SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        with self._mock_httpx_response(status_code=500, json_body={"detail": "boom"}):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert "HTTP 500" in result.error

    def test_real_inference_malformed_json_not_safe(self, temp_image):
        """BTD service returns invalid JSON -> success=False, never SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        with self._mock_httpx_response(status_code=200, json_body=None):
            result = asyncio.run(adapter.infer({
                "image_path": temp_image,
                "bag_id": 1,
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert "invalid JSON" in result.error

    def test_real_inference_image_not_found(self):
        """Missing image file -> success=False, requires review, not SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        result = asyncio.run(adapter.infer({
            "image_path": "/tmp/does_not_exist.jpg",
            "bag_id": 1,
        }))
        assert result.success is False
        assert result.requires_human_review is True
        assert "not found" in result.error

    def test_real_inference_no_service_url(self, temp_image):
        """No BTD_INFERENCE_URL configured -> service_unavailable, not SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter()  # no service_url
        result = asyncio.run(adapter.infer({
            "image_path": temp_image,
            "bag_id": 1,
        }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True

    def test_precomputed_path_still_works(self):
        """Existing callers supplying precomputed detections still work."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        result = asyncio.run(adapter.infer({
            "bag_id": 1,
            "detections": [
                {"item_type": "scissors", "confidence": 0.9},
            ],
        }))
        assert result.success is True
        assert result.detection == "MANUAL_REVIEW"
        assert result.metadata["detections"][0]["item_type"] == "scissors"


class TestBaggageAgentEndToEnd:
    """End-to-end: image upload triggers inference → decision → persistence → twin."""

    def test_baggage_scan_with_image_via_api(self, temp_image):
        db = SessionLocal()
        _seed_bag(db)
        db.close()

        # Mock the BTD inference endpoint to return a knife detection
        from app.agents.adapters.baggage import BaggageThreatAdapter
        orig_infer = BaggageThreatAdapter.infer

        async def fake_infer(self, payload):
            from app.agents.adapters.base import AdapterResult
            return AdapterResult(
                success=True,
                model_id="baggage_threat_detection",
                model_version="btd-yolo11",
                detection="MANUAL_REVIEW",
                confidence=0.93,
                verified_event="threat_detected",
                requires_human_review=True,
                metadata={
                    "bag_id": payload.get("bag_id"),
                    "detections": [{"item_type": "knife", "confidence": 0.93}],
                    "threat_found": True,
                },
            )

        BaggageThreatAdapter.infer = fake_infer
        try:
            r = client.post("/api/v1/agents/events",
                json={
                    "event_type": "baggage_scan",
                    "source": "api",
                    "payload": {
                        "bag_id": TEST_BAG_ID,
                        "image_path": temp_image,
                    },
                },
                headers=HEADERS,
            )
        finally:
            BaggageThreatAdapter.infer = orig_infer

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

        # Verify inspection + detected item persisted
        db = SessionLocal()
        insp = db.query(__import__("app.models.baggage_security_screening", fromlist=["BaggageInspection"]).BaggageInspection).first()
        assert insp is not None
        assert insp.result == "MANUAL_REVIEW"
        det = db.query(__import__("app.models.baggage_security_screening", fromlist=["DetectedItem"]).DetectedItem).first()
        assert det is not None
        assert det.item_type == "knife"
        # Bag held for review
        bag = db.query(Bag).filter(Bag.bag_id == TEST_BAG_ID).first()
        assert bag.current_status == "stationary"
        # Emergency event + alert created
        ee = db.query(EmergencyEvent).filter(EmergencyEvent.event_type == "suspicious_bag").first()
        assert ee is not None
        al = db.query(MonitoringAlert).filter(MonitoringAlert.behavior_type == "unattended_bag").first()
        assert al is not None
        # Task execution recorded (stored under the capability name "screen_baggage")
        from app.models.agents import AgentTask
        task = db.query(AgentTask).filter(AgentTask.task_type == "screen_baggage").first()
        assert task is not None
        assert task.status == "needs_review"

        # Digital Twin publishing attempted via the existing TwinPublisher
        from app.agents.service import agent_service
        assert agent_service.twin_publisher.publish_agent_event.called
        db.close()


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
            event_type="fire", zone_id=3,
            status="detected", detected_time=datetime.utcnow(),
        )
        db.add(ee)
        db.commit()
        db.refresh(ee)
        row = db.query(EmergencyEvent).filter(EmergencyEvent.event_type == "fire").first()
        assert row is not None
        assert row.event_type == "fire"
        assert row.event_id == ee.event_id
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


class TestSafetyAdapterSeverityMap:
    """Severity map must classify every supported event_type explicitly.

    These are unit tests against the in-memory SEVERITY_MAP — no model or
    network is involved.
    """
    def test_severity_map_covers_all_event_types(self):
        from app.agents.adapters.safety import SafetyAdapter, SEVERITY_MAP
        for et in ("smoke_detected", "fire_detected", "fall_detected",
                   "restricted_area", "unattended_bag", "overcrowding"):
            assert et in SEVERITY_MAP, f"missing severity for {et}"
        assert SEVERITY_MAP["smoke_detected"] == "critical"
        assert SEVERITY_MAP["fire_detected"] == "critical"
        assert SEVERITY_MAP["fall_detected"] == "high"
        assert SEVERITY_MAP["unattended_bag"] == "high"
        assert SEVERITY_MAP["restricted_area"] == "high"
        assert SEVERITY_MAP["overcrowding"] == "medium"


class TestSafetyAdapterUnitTests:
    """Unit tests for SafetyAdapter (precomputed detection path).

    These tests do NOT call a model or the network — they normalize
    pre-computed detection data. Real model inference through the adapter
    was verified separately against the running :8004 fall-detection service
    (see e2e note below).
    """

    def test_precomputed_fall_high_severity_requires_review(self):
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter()
        result = asyncio.run(adapter.infer({
            "event_type": "fall_detected",
            "detection_data": {"label": "confirmed_fall", "confidence": 0.9},
            "zone_id": 3,
            "camera_id": 10,
        }))
        assert result.success is True
        assert result.detection == "confirmed_fall"
        assert result.confidence == 0.9
        assert result.requires_human_review is True
        assert result.metadata["severity"] == "high"

    def test_precomputed_smoke_critical_requires_review(self):
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter()
        result = asyncio.run(adapter.infer({
            "event_type": "smoke_detected",
            "detection_data": {"label": "smoke", "confidence": 0.8},
            "zone_id": 2,
        }))
        assert result.success is True
        assert result.metadata["severity"] == "critical"
        assert result.requires_human_review is True

    def test_precomputed_no_detection_no_review(self):
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter()
        result = asyncio.run(adapter.infer({
            "event_type": "overcrowding",
            "detection_data": {"label": "none", "confidence": 0.0},
        }))
        assert result.success is True
        assert result.requires_human_review is True  # all safety events reviewed

    def test_unknown_event_type_errors_not_safe(self):
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter()
        result = asyncio.run(adapter.infer({
            "event_type": "not_a_real_event",
        }))
        assert result.success is False
        assert result.requires_human_review is True
        assert result.error is not None


class TestSafetyAdapterRealInference:
    """Tests for the SafetyAdapter HTTP path to the fall-detection service.

    These tests mock httpx because the fall-detection runtime (torch +
    mediapipe) runs in a separate Python 3.12 venv and is not importable
    here. The adapter code path is identical to the one exercised against the
    live :8004 service (see e2e note in the final report).
    """

    def _mock_httpx(self, post_json=None, get_json=None, exc=None, get_status=200):
        from unittest.mock import AsyncMock, MagicMock, patch

        post_resp = MagicMock()
        post_resp.status_code = 200
        post_resp.json = MagicMock(return_value=post_json or {"job_id": "job_1"})

        get_resp = MagicMock()
        get_resp.status_code = get_status
        get_resp.json = MagicMock(return_value=get_json or {})

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=post_resp)
        mock_client.get = AsyncMock(return_value=get_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        if exc is not None:
            mock_client.post = AsyncMock(side_effect=exc)
        return patch("httpx.AsyncClient", return_value=mock_client)

    def _make_temp_video(self, tmp_path):
        """Tiny dummy video file — content is irrelevant because httpx is
        mocked; the file just needs to exist so open() succeeds."""
        p = tmp_path / "fall.avi"
        p.write_bytes(b"\x00\x00\x00\x00dummy-video")
        return str(p)

    def test_real_inference_confirmed_fall(self, tmp_path):
        """Confirmed fall -> MANUAL_REVIEW, requires review, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        get_json = {
            "status": "completed",
            "confirmed_falls": 1,
            "summary": "Confirmed fall detected",
            "events": [{"status": "flagged", "seconds": 12.1},
                       {"status": "confirmed_fall", "seconds": 13.5}],
        }
        with self._mock_httpx(post_json={"job_id": "job_1"}, get_json=get_json):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
                "zone_id": 3,
                "camera_id": 10,
            }))
        assert result.success is True
        assert result.detection == "confirmed_fall"
        assert result.verified_event == "fall_candidate"
        assert result.requires_human_review is True
        assert result.metadata["summary"] == "Confirmed fall detected"
        assert len(result.metadata["events"]) == 2

    def test_real_inference_no_fall(self, tmp_path):
        """No confirmed fall -> not SAFE, still requires review (candidate)."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        get_json = {
            "status": "completed",
            "confirmed_falls": 0,
            "summary": "No confirmed fall detected",
            "events": [],
        }
        with self._mock_httpx(post_json={"job_id": "job_2"}, get_json=get_json):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is True
        assert result.detection == "no_fall"
        assert result.verified_event == "no_event"
        assert result.requires_human_review is False  # clean negative, no danger

    def test_real_inference_service_unavailable_never_safe(self, tmp_path):
        """Fall service unreachable -> success=False, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        import httpx
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        with self._mock_httpx(exc=httpx.ConnectError("refused")):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True

    def test_real_inference_timeout_never_safe(self, tmp_path):
        """Fall service timeout -> success=False, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        import httpx
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        with self._mock_httpx(exc=httpx.TimeoutException("timed out")):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True

    def test_precomputed_path_still_works(self):
        """Precomputed detections remain supported alongside live inference."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        result = asyncio.run(adapter.infer({
            "event_type": "unattended_bag",
            "detection_data": {"label": "unattended bag", "confidence": 0.9},
            "zone_id": 4,
        }))
        assert result.success is True
        assert result.metadata["severity"] == "high"
        assert result.requires_human_review is True


class TestSafetyAgentEndToEnd:
    """End-to-end: fall_detected event routed to SafetyAgent, persisted,
    and twin publish attempted. The fall inference is mocked here; real model
    inference was verified separately against the live :8004 service.
    """

    def test_fall_detected_workflow_via_api(self):
        from app.agents.adapters.safety import SafetyAdapter
        orig_infer = SafetyAdapter.infer

        async def fake_infer(self, payload):
            from app.agents.adapters.base import AdapterResult
            return AdapterResult(
                success=True,
                model_id="safety_detection",
                model_version="rf_fall_model",
                detection="confirmed_fall",
                confidence=None,
                verified_event="fall_candidate",
                requires_human_review=True,
                metadata={
                    "event_type": payload.get("event_type"),
                    "zone_id": payload.get("zone_id"),
                    "camera_id": payload.get("camera_id"),
                    "summary": "Confirmed fall detected",
                    "source": "fall_detection_service",
                },
            )

        SafetyAdapter.infer = fake_infer
        try:
            r = client.post("/api/v1/agents/events",
                json={
                    "event_type": "fall_detected",
                    "source": "iot_device",
                    "payload": {"video_path": "/tmp/fall.avi", "zone_id": 3, "camera_id": 10},
                    "severity": "high",
                },
                headers=HEADERS,
            )
        finally:
            SafetyAdapter.infer = orig_infer

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

        db = SessionLocal()
        # Emergency event persisted (event_type "fall" per agent rules)
        ee = db.query(EmergencyEvent).filter(EmergencyEvent.event_type == "fall").first()
        assert ee is not None
        assert ee.zone_id == 3
        # Monitoring alert persisted
        al = db.query(MonitoringAlert).filter(MonitoringAlert.behavior_type == "fall_detected").first()
        assert al is not None
        assert al.severity == "high"
        # Task execution recorded
        from app.models.agents import AgentTask
        task = db.query(AgentTask).filter(AgentTask.task_type == "assess_safety").first()
        assert task is not None
        assert task.status == "needs_review"
        # Decision audit recorded
        from app.models.agents import DecisionAudit
        da = db.query(DecisionAudit).filter(DecisionAudit.agent_id == "safety_agent").first()
        assert da is not None
        assert da.requires_human_review is True
        # Twin publish attempted
        from app.agents.service import agent_service
        assert agent_service.twin_publisher.publish_agent_event.called
        db.close()


class TestServiceFailureAndRetry:
    """Service failures are retried up to max_retries and never converted to SAFE.

    Valid negatives (e.g. no_fall, SAFE) are NOT retried — they are legitimate
    inference results. Only service_unavailable failures trigger retries.
    """

    def test_service_failure_retried_then_succeeds(self):
        """Service failure is retried; eventual success is NOT converted to SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        original_infer = adapter.infer
        call_count = 0

        async def flaky_infer(self, payload):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                from app.agents.adapters.base import AdapterResult
                return AdapterResult(
                    success=False,
                    model_id="baggage_threat_detection",
                    error="service unavailable",
                    service_unavailable=True,
                    requires_human_review=True,
                )
            return await original_infer(payload)

        adapter.infer = flaky_infer.__get__(adapter, BaggageThreatAdapter)

        db = SessionLocal()
        _seed_bag(db)
        db.close()

        from app.agents.service import agent_service
        agent_service.baggage_agent.threat_adapter = adapter

        try:
            orch = agent_service.get_orchestrator()
            asyncio.run(orch.ingest_event(
                event_type="baggage_scan",
                source="api",
                payload={"bag_id": TEST_BAG_ID, "detections": []},
                correlation_id="corr-retry-1",
            ))
        finally:
            agent_service.baggage_agent.threat_adapter = BaggageThreatAdapter(
                backend_url="http://localhost:8000/api/v1/ai/baggage/analyze"
            )

        assert call_count == 2, f"Expected 2 calls, got {call_count}"

        db = SessionLocal()
        insp = db.query(__import__("app.models.baggage_security_screening", fromlist=["BaggageInspection"]).BaggageInspection).first()
        assert insp is not None
        assert insp.result == "SAFE"
        db.close()

    def test_service_failure_exhausted_retries_not_safe(self):
        """Service failure exhausted retries → FAILED, never SAFE."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        adapter = BaggageThreatAdapter(service_url="http://localhost:8002/analyze")
        original_infer = adapter.infer
        call_count = 0

        async def always_fail_infer(self, payload):
            nonlocal call_count
            call_count += 1
            from app.agents.adapters.base import AdapterResult
            import httpx
            return AdapterResult(
                success=False,
                model_id="baggage_threat_detection",
                error="service unavailable",
                service_unavailable=True,
                requires_human_review=True,
            )

        adapter.infer = always_fail_infer.__get__(adapter, BaggageThreatAdapter)

        db = SessionLocal()
        _seed_bag(db)
        db.close()

        from app.agents.service import agent_service
        agent_service.baggage_agent.threat_adapter = adapter

        try:
            orch = agent_service.get_orchestrator()
            asyncio.run(orch.ingest_event(
                event_type="baggage_scan",
                source="api",
                payload={"bag_id": TEST_BAG_ID, "detections": []},
                correlation_id="corr-retry-2",
            ))
        finally:
            agent_service.baggage_agent.threat_adapter = BaggageThreatAdapter(
                backend_url="http://localhost:8000/api/v1/ai/baggage/analyze"
            )

        assert call_count == 3, f"Expected 3 call attempts, got {call_count}"

        db = SessionLocal()
        from app.models.agents import AgentTask
        task = db.query(AgentTask).filter(AgentTask.task_type == "screen_baggage").first()
        assert task is not None
        assert task.status == "failed"
        assert "service unavailable" in (task.error_message or "")
        db.close()


class TestDuplicateEventProtection:
    """Duplicate-event protection: retries do not create duplicate events,
    inspections, or Twin deliveries."""

    def test_duplicate_correlation_id_does_not_duplicate_workflow(self):
        """Submitting the same correlation_id twice creates only one workflow."""
        from app.agents.service import agent_service

        orch = agent_service.get_orchestrator()
        import asyncio

        # First submission
        asyncio.run(orch.ingest_event(
            event_type="baggage_scan",
            source="api",
            payload={"bag_id": TEST_BAG_ID, "detections": [{"item_type": "knife", "confidence": 0.9}]},
            correlation_id="corr-dup-test",
        ))

        # Second submission with same correlation_id
        asyncio.run(orch.ingest_event(
            event_type="baggage_scan",
            source="api",
            payload={"bag_id": TEST_BAG_ID, "detections": [{"item_type": "knife", "confidence": 0.9}]},
            correlation_id="corr-dup-test",
        ))

        # Only one workflow created
        from app.models.agents import WorkflowExecution
        db = SessionLocal()
        wfs = db.query(WorkflowExecution).filter(
            WorkflowExecution.correlation_id == "corr-dup-test"
        ).all()
        assert len(wfs) == 1, f"Expected 1 workflow, got {len(wfs)}"
        db.close()


class TestTwinDeliveryStatus:
    """Twin delivery status is tracked separately from inference success.

    Expired/invalid JWTs (401/403) are detected as auth_error and never
    silently reported as successful delivery.
    """

    def test_twin_delivery_recorded_in_workflow_output(self):
        """Twin delivery status appears in workflow output_payload."""
        from app.agents.adapters.baggage import BaggageThreatAdapter
        import asyncio

        orig_infer = BaggageThreatAdapter.infer

        async def fake_infer(self, payload):
            from app.agents.adapters.base import AdapterResult
            return AdapterResult(
                success=True,
                model_id="baggage_threat_detection",
                model_version="btd-yolo11",
                detection="SAFE",
                confidence=None,
                verified_event="no_items_detected",
                requires_human_review=False,
                metadata={"bag_id": payload.get("bag_id"), "detections": [], "threat_found": False},
            )

        BaggageThreatAdapter.infer = fake_infer
        try:
            db = SessionLocal()
            _seed_bag(db)
            db.close()

            r = client.post("/api/v1/agents/events",
                json={
                    "event_type": "baggage_scan",
                    "source": "api",
                    "payload": {"bag_id": TEST_BAG_ID, "detections": []},
                },
                headers=HEADERS,
            )
        finally:
            BaggageThreatAdapter.infer = orig_infer

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True

        db = SessionLocal()
        from app.models.agents import WorkflowExecution
        wf = db.query(WorkflowExecution).filter(
            WorkflowExecution.name == "baggage_screening"
        ).order_by(WorkflowExecution.started_at.desc()).first()
        assert wf is not None
        output = json.loads(wf.output_payload or "{}")
        assert "twin_delivery" in output
        td = output["twin_delivery"]
        assert "delivered" in td
        assert "auth_error" in td
        db.close()


class TestSafetyAgentRealInference:
    """Tests for the SafetyAdapter HTTP path to the fall-detection service.

    These tests mock httpx because the fall-detection runtime (torch +
    mediapipe) runs in a separate Python 3.12 venv and is not importable
    here. The adapter code path is identical to the one exercised against
    the live :8004 fall-detection service.
    """

    def _make_temp_video(self, tmp_path):
        """Tiny dummy video file — content is irrelevant because httpx is
        mocked; the file just needs to exist so open() succeeds."""
        p = tmp_path / "fall.avi"
        p.write_bytes(b"\x00\x00\x00\x00dummy-video")
        return str(p)

    def _mock_httpx(self, post_json=None, get_json=None, exc=None, get_status=200):
        """Build a mock httpx AsyncClient context manager."""
        from unittest.mock import AsyncMock, MagicMock, patch

        post_resp = MagicMock()
        post_resp.status_code = 200
        post_resp.json = MagicMock(return_value=post_json or {"job_id": "job_1"})

        get_resp = MagicMock()
        get_resp.status_code = get_status
        get_resp.json = MagicMock(return_value=get_json or {})

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=post_resp)
        mock_client.get = AsyncMock(return_value=get_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        if exc is not None:
            mock_client.post = AsyncMock(side_effect=exc)
        return patch("httpx.AsyncClient", return_value=mock_client)

    def test_real_inference_confirmed_fall(self, tmp_path):
        """Confirmed fall → MANUAL_REVIEW, requires review, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        get_json = {
            "status": "completed",
            "confirmed_falls": 1,
            "summary": "Confirmed fall detected",
            "events": [{"status": "flagged", "seconds": 12.1},
                       {"status": "confirmed_fall", "seconds": 13.5}],
        }
        with self._mock_httpx(post_json={"job_id": "job_1"}, get_json=get_json):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
                "zone_id": 3,
                "camera_id": 10,
            }))
        assert result.success is True
        assert result.detection == "confirmed_fall"
        assert result.verified_event == "fall_candidate"
        assert result.requires_human_review is True
        assert result.metadata["summary"] == "Confirmed fall detected"

    def test_real_inference_no_fall(self, tmp_path):
        """No confirmed fall → not SAFE, still requires review (candidate)."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        get_json = {
            "status": "completed",
            "confirmed_falls": 0,
            "summary": "No confirmed fall detected",
            "events": [],
        }
        with self._mock_httpx(post_json={"job_id": "job_2"}, get_json=get_json):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is True
        assert result.detection == "no_fall"
        assert result.verified_event == "no_event"
        assert result.requires_human_review is False

    def test_real_inference_service_unavailable_never_safe(self, tmp_path):
        """Fall service unreachable → success=False, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        import httpx
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        with self._mock_httpx(exc=httpx.ConnectError("refused")):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True

    def test_real_inference_timeout_never_safe(self, tmp_path):
        """Fall service timeout → success=False, never SAFE."""
        from app.agents.adapters.safety import SafetyAdapter
        import asyncio
        import httpx
        adapter = SafetyAdapter(fall_detection_url="http://localhost:8004")
        with self._mock_httpx(exc=httpx.TimeoutException("timed out")):
            result = asyncio.run(adapter.infer({
                "event_type": "fall_detected",
                "video_path": self._make_temp_video(tmp_path),
            }))
        assert result.success is False
        assert result.service_unavailable is True
        assert result.requires_human_review is True

