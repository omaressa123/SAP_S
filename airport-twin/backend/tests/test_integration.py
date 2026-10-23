"""Step 6 integration test: ingest POST -> real WebSocket -> client payload.

Proves the full live path (the MQTT/gateway equivalent: any producer that
calls apply_reading reaches every connected client with the same contract).
"""
import pytest
from starlette.websockets import WebSocketDisconnect

from test_ingest import client


def test_ingest_broadcast_reaches_websocket_client():
    with client.websocket_connect("/ws/twin") as ws:
        r = client.post("/api/twin/ingest", json={
            "asset_id": "CAM-001", "telemetry": {"queue_length": 7},
        })
        assert r.status_code == 202
        msg = ws.receive_json()
        assert msg["event"] == "asset_telemetry"
        assert msg["asset_id"] == "CAM-001"
        assert msg["source"] == "ingest"
        assert msg["telemetry"]["queue_length"] == 7


def test_websocket_connects_without_token():
    # No JWT is required on the twin WebSocket anymore.
    with client.websocket_connect("/ws/twin") as ws:
        # Connection established successfully; close immediately.
        pass
