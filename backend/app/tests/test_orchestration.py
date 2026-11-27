"""Tests for Multi-Agent Workflow Orchestration and AI Agent Notifications."""
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.agents import AgentDeployment, AgentNotification
from app.models.devices import Equipment

client = TestClient(app)
HEADERS = {"X-API-KEY": "MOCK_API_KEY_123"}


def test_models_and_device_registration_and_multi_instance_deployment():
    # 1. Discover existing AI models
    with patch("app.controllers.orchestration_controller._probe_model_health") as mock_probe:
        mock_probe.return_value = {"reachable": True, "status": "online", "health_url": "http://face-reco:8001/health", "error": None}
        r = client.get("/api/v1/agents/models", headers=HEADERS)
        assert r.status_code == 200
        models = r.json()["data"]
        assert len(models) == 5
        assert any(m["id"] == "face_recognition" for m in models)

        # 2. Register two camera devices and one xray device
        s1 = f"CAM-TEST-{uuid.uuid4().hex[:6]}"
        s2 = f"CAM-TEST-{uuid.uuid4().hex[:6]}"
        s3 = f"XRAY-TEST-{uuid.uuid4().hex[:6]}"

        d1 = client.post("/api/v1/agents/devices", json={"label": "Gate A1 Camera", "equipment_type": "camera", "serial_number": s1, "location": "Gate A1"}, headers=HEADERS).json()["data"]
        d2 = client.post("/api/v1/agents/devices", json={"label": "Gate A2 Camera", "equipment_type": "camera", "serial_number": s2, "location": "Gate A2"}, headers=HEADERS).json()["data"]
        d3 = client.post("/api/v1/agents/devices", json={"label": "Lane 1 XRay", "equipment_type": "xray", "serial_number": s3, "location": "Security Lane 1"}, headers=HEADERS).json()["data"]

        # 3. Incompatible device rejected
        bad = client.post(
            "/api/v1/agents/deployments",
            json={"agent_name": "Bad Face Agent", "model_id": "face_recognition", "device_id": d3["equipment_id"]},
            headers=HEADERS,
        )
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "INCOMPATIBLE_DEVICE"

        # 4. Deploy two instances of face_recognition onto d1 and d2
        dep1 = client.post(
            "/api/v1/agents/deployments",
            json={"agent_name": "Face Agent A1", "model_id": "face_recognition", "device_id": d1["equipment_id"]},
            headers=HEADERS,
        ).json()["data"]
        assert dep1["status"] == "running"

        dup = client.post(
            f"/api/v1/agents/deployments/{dep1['deployment_id']}/duplicate",
            json={"device_id": d2["equipment_id"], "agent_name": "Face Agent A2"},
            headers=HEADERS,
        )
        assert dup.status_code == 200
        dep2 = dup.json()["data"]
        assert dep2["device_id"] == d2["equipment_id"]
        assert dep2["model_id"] == "face_recognition"

        # 5. Stop, restart, repair lifecycle
        stopped = client.post(f"/api/v1/agents/deployments/{dep1['deployment_id']}/stop", headers=HEADERS).json()["data"]
        assert stopped["status"] == "stopped"

        restarted = client.post(f"/api/v1/agents/deployments/{dep1['deployment_id']}/restart", headers=HEADERS).json()["data"]
        assert restarted["status"] == "running"

        repaired = client.post(f"/api/v1/agents/deployments/{dep1['deployment_id']}/repair", headers=HEADERS).json()["data"]
        assert repaired["repaired"] is True

        # 6. Notifications created & acknowledge/resolve flow
        notifs = client.get("/api/v1/agents/notifications?sync=false", headers=HEADERS).json()["data"]["notifications"]
        assert len(notifs) >= 2
        nid = notifs[0]["notification_id"]
        assert client.post(f"/api/v1/agents/notifications/{nid}/read", headers=HEADERS).json()["data"]["is_read"] is True
        assert client.post(f"/api/v1/agents/notifications/{nid}/acknowledge", headers=HEADERS).json()["data"]["status"] == "acknowledged"
        assert client.post(f"/api/v1/agents/notifications/{nid}/resolve", headers=HEADERS).json()["data"]["status"] == "resolved"

        # 7. Cleanup deployments + test devices
        assert client.delete(f"/api/v1/agents/deployments/{dep1['deployment_id']}", headers=HEADERS).status_code == 200
        assert client.delete(f"/api/v1/agents/deployments/{dep2['deployment_id']}", headers=HEADERS).status_code == 200

    db = SessionLocal()
    try:
        db.query(AgentNotification).filter(AgentNotification.agent_name.in_(["Face Agent A1", "Face Agent A2"])).delete(synchronize_session=False)
        db.query(Equipment).filter(Equipment.serial_number.in_([s1, s2, s3])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
