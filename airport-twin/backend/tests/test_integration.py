"""Step 6 integration test: ingest POST -> real WebSocket -> client payload.

Proves the full live path (the MQTT/gateway equivalent: any producer that
calls apply_reading reaches every connected client with the same contract).
"""
import pytest
from starlette.websockets import WebSocketDisconnect

from test_ingest import auth_headers, client

OPERATOR = auth_headers("operator")
TOKEN = OPERATOR["Authorization"].split(" ", 1)[1]


def test_ingest_broadcast_reaches_websocket_client():
    with client.websocket_connect(f"/ws/twin?token={TOKEN}") as ws:
        r = client.post("/api/twin/ingest", headers=OPERATOR, json={
            "asset_id": "CAM-001", "telemetry": {"queue_length": 7},
        })
        assert r.status_code == 202
        msg = ws.receive_json()
        assert msg["event"] == "asset_telemetry"
        assert msg["asset_id"] == "CAM-001"
        assert msg["source"] == "ingest"
        assert msg["telemetry"]["queue_length"] == 7


def test_websocket_rejects_missing_token():
    with pytest.raises(WebSocketDisconnect) as ei:
        with client.websocket_connect("/ws/twin") as ws:
            ws.receive_json()
    assert ei.value.code == 4401
