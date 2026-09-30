"""Step 4 tests: real ingest path (DB + broadcast contract), sim flag gating.

Isolated DB: DATABASE_URL points at a temp sqlite file BEFORE app import.
TWIN_SIMULATION=false keeps the suite deterministic (no random sim writes).
Step 5: every call authenticates (see auth_headers).
"""
import os

os.environ["DATABASE_URL"] = "sqlite:////tmp/test_twin_step4.db"
os.environ["TWIN_SIMULATION"] = "false"
if os.path.exists("/tmp/test_twin_step4.db"):
    os.remove("/tmp/test_twin_step4.db")

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from services.twin import seed as seed_db  # noqa: E402

# TestClient without a context manager skips lifespan: seed explicitly.
seed_db()
client = TestClient(app)

CREDS = {"admin": ("admin", "admin123"), "operator": ("operator", "op123"), "viewer": ("viewer", "view123")}


def auth_headers(role: str = "operator") -> dict:
    u, p = CREDS[role]
    t = client.post("/api/twin/auth/token", data={"username": u, "password": p}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


OP = auth_headers("operator")


def test_mode_reports_ingest_when_sim_disabled():
    r = client.get("/api/twin/mode", headers=OP)
    assert r.status_code == 200
    assert r.json() == {"simulation": False, "source": "ingest"}


def test_ingest_status_update_writes_db_and_event():
    r = client.post("/api/twin/ingest", headers=OP, json={
        "asset_id": "CONV-001", "status": "warning", "reason": "vibration_high",
        "health_score": 0.71, "telemetry": {"bags_processed": 250},
    })
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["accepted"] is True
    assert "asset_status_changed" in body["emitted"]
    assert "asset_telemetry" in body["emitted"]

    got = client.get("/api/twin/assets/CONV-001", headers=OP).json()
    assert got["status"] == "warning"

    evts = client.get("/api/twin/assets/CONV-001/events", headers=OP).json()
    kinds = {e["event_type"] for e in evts}
    assert {"asset_status_changed", "asset_telemetry"} <= kinds
    tel = next(e for e in evts if e["event_type"] == "asset_telemetry")
    assert tel["payload"]["bags_processed"] == 250
    assert tel["payload"]["source"] == "ingest"


def test_ingest_heartbeat_when_nothing_changed():
    # Same status as current state + no telemetry -> heartbeat, still bumps last_seen.
    cur = client.get("/api/twin/assets/CONV-002", headers=OP).json()["status"]
    r = client.post("/api/twin/ingest", headers=OP, json={"asset_id": "CONV-002", "status": cur})
    assert r.status_code == 202
    assert r.json()["emitted"] == ["heartbeat"]


def test_ingest_unknown_asset_404():
    r = client.post("/api/twin/ingest", headers=OP, json={"asset_id": "NOPE-999", "status": "offline"})
    assert r.status_code == 404


def test_ingest_validation_422():
    assert client.post("/api/twin/ingest", headers=OP, json={}).status_code == 422
    assert client.post("/api/twin/ingest", headers=OP,
                       json={"asset_id": "CONV-001", "health_score": 9.9}).status_code == 422


def test_ingest_batch_partial_success():
    r = client.post("/api/twin/ingest/batch", headers=OP, json={"readings": [
        {"asset_id": "SNS-001", "telemetry": {"weight_kg": 23.5}},
        {"asset_id": "GHOST-1", "status": "offline"},
    ]})
    assert r.status_code == 202
    body = r.json()
    assert len(body["accepted"]) == 1
    assert len(body["errors"]) == 1
    assert body["errors"][0]["asset_id"] == "GHOST-1"


def test_ingest_robot_position_flows_to_robots_endpoint():
    r = client.post("/api/twin/ingest", headers=OP, json={
        "asset_id": "RB-007", "position": {"x": 12.0, "y": 0, "z": -2.0},
        "telemetry": {"battery_pct": 88},
    })
    assert r.status_code == 202
    assert r.json()["emitted"] == ["asset_telemetry"]
    robots = {x["asset_id"]: x for x in client.get("/api/twin/robots", headers=OP).json()}
    assert robots["RB-007"]["position"] == {"x": 12.0, "y": 0, "z": -2.0}
