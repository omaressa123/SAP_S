"""Step 6 tests: JSON logs, Prometheus metrics, offline/stale watchdog."""
import json
import logging
import re

from models.db import Session, Asset, State
from services import alerts as alerts_mod
from services.logging import JsonFormatter
from services.twin import hub
from test_ingest import client


def test_log_records_are_json():
    rec = logging.LogRecord("twin.test", logging.INFO, __file__, 1,
                            "reading applied", None, None)
    rec.asset_id = "CONV-001"
    obj = json.loads(JsonFormatter().format(rec))
    assert obj["level"] == "INFO" and obj["msg"] == "reading applied"
    assert obj["asset_id"] == "CONV-001" and "ts" in obj


def test_metrics_endpoint_and_ingest_counter():
    before = client.get("/metrics").text
    assert "twin_broadcasts_total" in before and "twin_api_latency_seconds" in before

    def accepted_count(text: str) -> float:
        m = re.search(r'twin_ingest_total\{result="accepted"\} ([\d.]+)', text)
        return float(m.group(1)) if m else 0.0

    n0 = accepted_count(before)
    client.post("/api/twin/ingest",
                json={"asset_id": "SNS-001", "telemetry": {"rssi_dbm": -61}})
    n1 = accepted_count(client.get("/metrics").text)
    assert n1 == n0 + 1


async def _capture_broadcasts(coro):
    seen: list[dict] = []

    async def rec(msg):
        seen.append(msg)

    orig = hub.broadcast
    hub.broadcast = rec
    try:
        out = await coro
    finally:
        hub.broadcast = orig
    return out, seen


def test_watchdog_alerts_offline_device():
    import asyncio
    client.post("/api/twin/ingest",
                json={"asset_id": "CONV-002", "status": "offline", "reason": "motor_failure"})
    raised, seen = asyncio.run(_capture_broadcasts(alerts_mod.check_once()))
    assert any(a["asset_id"] == "CONV-002" and a["kind"] == "offline" for a in raised)
    assert any(m["event"] == "device_alert" and m["asset_id"] == "CONV-002" for m in seen)
    # Cooldown: second pass stays silent.
    raised2, _ = asyncio.run(_capture_broadcasts(alerts_mod.check_once()))
    assert not any(a["asset_id"] == "CONV-002" for a in raised2)


def test_watchdog_alerts_stale_device():
    import asyncio
    import datetime as dt
    with Session() as s:
        a = s.scalar(__import__("sqlalchemy").select(Asset).where(Asset.asset_code == "SNS-001"))
        st = s.get(State, a.id)
        st.status = "operational"
        st.last_seen_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=10000)
        s.commit()
    raised, seen = asyncio.run(_capture_broadcasts(alerts_mod.check_once()))
    assert any(a["asset_id"] == "SNS-001" and a["kind"] == "stale" for a in raised)
    assert any(m["event"] == "device_alert" for m in seen)
