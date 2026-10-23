"""Tests for M2.6 Bidirectional IoT MQTT Bridge.

The paho-mqtt client is faked so no real broker is required. Bridge behaviour
(command publishing, acknowledgement matching, duplicate protection, timeouts,
bounded retries, telemetry routing, health) is tested against the isolated
SQLite test database.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from typing import Any, Dict, Optional
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal, engine
from app.main import app
from app.models.iot import IotCommandLog, IotTelemetryLog
from app.agents.registry import AgentRegistry
from app.agents.events import EventSystem
from app.agents.iot_bridge import IoTMqttBridge, DEFAULT_TIMEOUT_SECONDS, KNOWN_MODULES
from app.agents.base import AgentInterface, AgentResult, AgentStatus
from app.agents.service import agent_service


class FakeMqttClient:
    """Stand-in for paho.mqtt.client.Client."""

    def __init__(self):
        self.connect_called = False
        self.subscribed: list = []
        self.published: list = []
        self.loop_started = False
        self.loop_stopped = False
        self.disconnected = False
        self.on_connect = None
        self.on_message = None
        self.on_disconnect = None

    def connect(self, host, port, keepalive=60):
        self.connect_called = True
        self.host = host
        self.port = port
        if self.on_connect:
            self.on_connect(self, None, {}, 0)
        return 0

    def loop_start(self):
        self.loop_started = True

    def loop_stop(self):
        self.loop_stopped = True

    def disconnect(self):
        self.disconnected = True

    def subscribe(self, topics):
        self.subscribed = list(topics)
        return (0, 0)

    def publish(self, topic, payload, qos=0, retain=False):
        self.published.append((topic, payload, qos, retain))
        return (1, 0)


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


def _new_bridge(mqtt_client=None):
    registry = AgentRegistry()
    event_system = EventSystem(db_session_factory=SessionLocal)
    twin = AsyncMock()
    twin.publish_agent_event = AsyncMock(return_value=True)
    bridge = IoTMqttBridge(
        registry=registry, event_system=event_system,
        twin_publisher=twin, mqtt_client=mqtt_client,
    )
    return registry, event_system, twin, bridge


def _clean_iot_tables():
    db = SessionLocal()
    try:
        for tbl in ["iottelemetrylog", "iotcommandlog"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _clean():
    _clean_iot_tables()
    yield
    _clean_iot_tables()


# ------------------------------------------------------------------ lifecycle

def test_bridge_start_connects_and_subscribes():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    assert bridge._connected is True
    assert client.loop_started
    assert any(t[0] == "airport/equipment/+/telemetry" for t in client.subscribed)
    assert any(t[0] == "airport/gate/+/status" for t in client.subscribed)
    assert any(t[0] == "airport/device/+/heartbeat" for t in client.subscribed)
    bridge.stop()
    assert client.loop_stopped
    assert client.disconnected


# ------------------------------------------------------------------ command publishing + ack

def test_publish_command_persists_and_publishes():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    cmd_id = bridge.publish_command(
        device_id="GATE-001", module="gate", command="UNLOCK",
        agent_id="identity_agent", correlation_id="corr-1",
    )
    assert cmd_id.startswith("cmd_")
    assert any(topic == "airport/gate/GATE-001/command" for topic, _, _, _ in client.published)
    sent = client.published[-1][1]
    payload = json.loads(sent)
    assert payload["command_id"] == cmd_id
    assert payload["command"] == "UNLOCK"

    # Stored as pending -> dispatched.
    row = bridge.get_command(cmd_id)
    assert row is not None
    assert row["status"] in ("pending", "dispatched")
    assert row["dispatched_by_agent"] == "identity_agent"
    assert row["module"] == "gate"
    bridge.stop()


def test_command_ack_transitions_to_acknowledged():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._connected = True
    cmd_id = bridge.publish_command(
        device_id="GATE-001", module="gate", command="UNLOCK",
        agent_id="identity_agent",
    )
    # Device acknowledges the command on its status/telemetry topic.
    bridge._on_message(
        client, None,
        type("Msg", (), {"topic": "airport/gate/GATE-001/status",
                         "payload": json.dumps({
                             "command_id": cmd_id, "ack": True,
                             "state": "UNLOCKED", "timestamp": 12345,
                         }).encode()})(),
    )
    row = bridge.get_command(cmd_id)
    assert row["ack_received"] is True
    assert row["status"] == "acknowledged"
    assert row["ack_payload"]["ack"] is True
    bridge.stop()


def test_command_without_ack_times_out_never_claimed_success():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._connected = True
    cmd_id = bridge.publish_command(
        device_id="GATE-001", module="gate", command="UNLOCK",
        agent_id="identity_agent", timeout_seconds=1,
    )

    def qrow():
        db = SessionLocal()
        try:
            return db.query(IotCommandLog).filter(IotCommandLog.command_id == cmd_id).first()
        finally:
            db.close()

    def expire():
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        db = SessionLocal()
        row = db.query(IotCommandLog).filter(IotCommandLog.command_id == cmd_id).first()
        row.expires_at = past
        db.commit()
        db.close()
        if cmd_id in bridge._pending:
            bridge._pending[cmd_id]["expires_at"] = past.isoformat()

    expire()
    # First reconcile with retries remaining: retries, never claims success.
    bridge._reconcile_pending()
    row = qrow()
    assert row.ack_received is False
    assert row.status != "acknowledged"

    # Exhaust retries -> terminal timeout, still never acknowledged.
    status = qrow().status
    for _ in range(6):
        if status == "timeout":
            break
        expire()
        bridge._reconcile_pending()
        status = qrow().status
    row = qrow()
    assert row.status == "timeout", status
    assert row.ack_received is False
    assert "timed out" in (row.error_message or "")
    bridge.stop()


def test_bounded_retry_then_timeout():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._connected = True
    cmd_id = bridge.publish_command(
        device_id="GATE-001", module="gate", command="UNLOCK",
        agent_id="identity_agent", timeout_seconds=1,
    )

    def qrow():
        db = SessionLocal()
        try:
            return db.query(IotCommandLog).filter(IotCommandLog.command_id == cmd_id).first()
        finally:
            db.close()

    def expire():
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        db = SessionLocal()
        row = db.query(IotCommandLog).filter(IotCommandLog.command_id == cmd_id).first()
        row.expires_at = past
        db.commit()
        db.close()
        if cmd_id in bridge._pending:
            bridge._pending[cmd_id]["expires_at"] = past.isoformat()

    # 3 retries (retry_count 0->1->2->3), each republishing.
    for expected in (1, 2, 3):
        expire()
        bridge._reconcile_pending()
        row = qrow()
        assert row.retry_count == expected, row.retry_count
        assert any(t[0] == "airport/gate/GATE-001/command" for t in client.published)

    # 4th reconcile: retries exhausted -> terminal timeout, never claimed success.
    expire()
    bridge._reconcile_pending()
    row = qrow()
    assert row.status == "timeout"
    assert row.retry_count == 3
    assert row.ack_received is False
    assert "timed out" in (row.error_message or "")
    bridge.stop()


def test_duplicate_message_ignored():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._connected = True
    msg = {
        "topic": "airport/equipment/EQUIPMENT-001/telemetry",
        "payload": json.dumps({
            "message_id": "dup-1", "device_id": "EQUIPMENT-001",
            "temperature": 50.0, "timestamp": 1,
        }).encode(),
    }
    bridge._on_message(client, None, type("Msg", (), msg)())
    bridge._on_message(client, None, type("Msg", (), msg)())  # duplicate
    bridge._on_message(client, None, type("Msg", (), {
        "topic": "airport/equipment/EQUIPMENT-001/telemetry",
        "payload": json.dumps({
            "message_id": "dup-2", "device_id": "EQUIPMENT-001",
            "temperature": 51.0, "timestamp": 2,
        }).encode(),
    })())
    assert bridge._stats["duplicates"] == 1
    bridge.stop()


def test_malformed_telemetry_rejected():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._on_message(client, None, type("Msg", (), {
        "topic": "airport/unknown-module/DEV-001/telemetry",
        "payload": b"not-json",
    })())
    assert bridge._stats["malformed"] >= 1
    bridge.stop()


# ------------------------------------------------------------------ telemetry routing

def test_telemetry_routed_to_maintenance_agent():
    registry = AgentRegistry()
    maint = FakeAgent("maintenance_agent", "process_telemetry", "equipment_telemetry",
                      AgentResult(success=True, data={"health_score": 90}))
    registry.register(maint)
    event_system = EventSystem(db_session_factory=SessionLocal)
    bridge = IoTMqttBridge(registry=registry, event_system=event_system,
                           twin_publisher=None, mqtt_client=FakeMqttClient())
    bridge._connected = True
    bridge._handle_incoming("equipment", "EQUIPMENT-001", "telemetry", {
        "device_id": "EQUIPMENT-001", "temperature": 50.0, "vibration_rms": 1.2,
    })
    assert len(maint.calls) == 1
    assert maint.calls[0]["device_id"] == "EQUIPMENT-001"


# ------------------------------------------------------------------ health / queries

def test_health_and_list_commands():
    client = FakeMqttClient()
    _, _, _, bridge = _new_bridge(client)
    bridge.start()
    bridge._connected = True
    bridge.publish_command(device_id="GATE-001", module="gate", command="LOCK",
                           agent_id="safety_agent")
    health = bridge.get_health()
    assert health.broker == settings.MQTT_BROKER
    assert health.port == settings.MQTT_PORT
    assert health.pending_commands >= 1
    cmds = bridge.list_commands()
    assert len(cmds) >= 1
    bridge.stop()


# ------------------------------------------------------------------ controller API via TestClient

@pytest.fixture
def client():
    return TestClient(app)


def test_controller_dispatch_valid(client):
    resp = client.post("/api/v1/agents/iot/dispatch", json={
        "device_id": "GATE-001", "module": "gate", "command": "UNLOCK",
        "agent_id": "identity_agent",
    }, headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    cmd_id = body["data"]["command_id"]
    assert body["data"]["status"] == "pending"

    get_resp = client.get(f"/api/v1/agents/iot/commands/{cmd_id}",
                          headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["status"] == "pending"


def test_controller_dispatch_invalid_module(client):
    resp = client.post("/api/v1/agents/iot/dispatch", json={
        "device_id": "DEV-001", "module": "not-a-module", "command": "OPEN",
        "agent_id": "identity_agent",
    }, headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 400


def test_controller_dispatch_invalid_command(client):
    resp = client.post("/api/v1/agents/iot/dispatch", json={
        "device_id": "GATE-001", "module": "gate", "command": "FLY_TO_THE_MOON",
        "agent_id": "identity_agent",
    }, headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 400


def test_controller_health(client):
    resp = client.get("/api/v1/agents/iot/health", headers={"X-API-KEY": "MOCK_API_KEY_123"})
    assert resp.status_code == 200
    assert "pending_commands" in resp.json()["data"]
