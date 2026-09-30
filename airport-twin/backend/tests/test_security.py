"""Step 5 tests: JWT auth, RBAC, audited commands, health/readiness, pose persistence.

Shares the isolated DB seeded by test_ingest (import order: ingest first).
"""
from fastapi.testclient import TestClient

from main import app
from services import robots as robots_mod
from test_ingest import auth_headers, client  # noqa: F401 — reuse seeded client

assert isinstance(client, TestClient)

VIEWER = auth_headers("viewer")
OPERATOR = auth_headers("operator")
ADMIN = auth_headers("admin")


def test_login_roundtrip_and_me():
    assert client.get("/api/twin/auth/me", headers=VIEWER).json() == {"username": "viewer", "role": "viewer"}
    assert client.get("/api/twin/auth/me", headers=ADMIN).json()["role"] == "admin"


def test_login_bad_credentials_401():
    r = client.post("/api/twin/auth/token", data={"username": "viewer", "password": "wrong"})
    assert r.status_code == 401


def test_protected_routes_reject_anonymous():
    assert client.get("/api/twin/assets").status_code == 401
    assert client.get("/api/twin/flights").status_code == 401
    assert client.post("/api/twin/ingest", json={"asset_id": "CONV-001"}).status_code == 401


def test_viewer_cannot_write_403():
    assert client.post("/api/twin/ingest", headers=VIEWER,
                       json={"asset_id": "CONV-001"}).status_code == 403
    assert client.post("/api/twin/assets/CONV-001/command", headers=VIEWER,
                       json={"command": "stop"}).status_code == 403
    assert client.get("/api/twin/admin/ping", headers=VIEWER).status_code == 403
    assert client.get("/api/twin/admin/ping", headers=OPERATOR).status_code == 403
    assert client.get("/api/twin/admin/ping", headers=ADMIN).status_code == 200


def test_command_endpoint_audits_who_what_result():
    r = client.post("/api/twin/assets/CONV-001/command", headers=OPERATOR,
                    json={"command": "belt_stop", "params": {"reason": "jam"}})
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["result"] == "accepted"

    evts = client.get("/api/twin/assets/CONV-001/events", headers=OPERATOR).json()
    cmds = [e for e in evts if e["event_type"] == "asset_command"]
    assert cmds, "command must leave an audit row"
    audit = cmds[0]["payload"]
    assert audit["user"] == "operator" and audit["command"] == "belt_stop"
    assert audit["params"] == {"reason": "jam"} and audit["result"] == "accepted"


def test_command_unknown_asset_404():
    assert client.post("/api/twin/assets/NOPE-9/command", headers=OPERATOR,
                       json={"command": "x"}).status_code == 404


def test_health_and_ready_open():
    assert client.get("/health").json() == {"status": "ok"}
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json()["ready"] is True


def test_robot_pose_survives_memory_loss():
    """Poses live in robot_positions, not just the process dict."""
    client.post("/api/twin/ingest", headers=OPERATOR,
                json={"asset_id": "RB-007", "position": {"x": 7.5, "y": 0, "z": 3.5}})
    robots_mod.poses.clear()  # simulate a restart: memory gone
    robots = {x["asset_id"]: x for x in client.get("/api/twin/robots", headers=OPERATOR).json()}
    assert robots["RB-007"]["position"] == {"x": 7.5, "y": 0, "z": 3.5}
