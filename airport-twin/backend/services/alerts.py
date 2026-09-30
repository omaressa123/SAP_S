"""Offline/stale device watchdog (Step 6): real alerting, not just colors.

Every CHECK interval the watchdog scans twin_asset_state and raises a
`device_alert` (DB event + WebSocket broadcast + log + metric) for:
  - status == "offline"   (kind=offline)
  - status == "critical"  (kind=critical)
  - last_seen_at older than OFFLINE_AFTER_S (kind=stale)
Per-asset cooldown (COOLDOWN_S) prevents alert storms. Recovered assets
clear their cooldown entry so the next outage alerts again.

Env: TWIN_ALERT_INTERVAL_S (30), TWIN_OFFLINE_AFTER_S (300),
     TWIN_ALERT_COOLDOWN_S (900).
"""
import asyncio
import os
import time

from sqlalchemy import select

from models.db import Session, Asset, State, Event, now
from services.logging import get_logger
from services.twin import hub

log = get_logger("alerts")

CHECK_INTERVAL_S = float(os.getenv("TWIN_ALERT_INTERVAL_S", "30"))
OFFLINE_AFTER_S = float(os.getenv("TWIN_OFFLINE_AFTER_S", "300"))
COOLDOWN_S = float(os.getenv("TWIN_ALERT_COOLDOWN_S", "900"))

_sent: dict[str, float] = {}


def _age_s(last_seen) -> float:
    if last_seen is None:
        return float("inf")
    if last_seen.tzinfo is None:  # sqlite returns naive datetimes
        last_seen = last_seen.replace(tzinfo=now().tzinfo)
    return (now() - last_seen).total_seconds()


async def check_once() -> list[dict]:
    """Single watchdog pass. Returns the alerts raised (test hook)."""
    from services.metrics import alerts_total
    raised: list[dict] = []
    with Session() as s:
        rows = s.execute(
            select(Asset.id, Asset.asset_code, State.status, State.last_seen_at)
            .join(State, State.asset_id == Asset.id)).all()
    for db_id, code, status, last_seen in rows:
        kind = None
        if status == "offline":
            kind = "offline"
        elif status == "critical":
            kind = "critical"
        elif _age_s(last_seen) > OFFLINE_AFTER_S:
            kind = "stale"
        if kind is None:
            _sent.pop(code, None)
            continue
        if time.time() - _sent.get(code, 0.0) < COOLDOWN_S:
            continue
        _sent[code] = time.time()
        age = _age_s(last_seen)
        payload = {"kind": kind, "status": status, "age_s": round(age, 1)}
        with Session() as s:
            s.add(Event(asset_id=db_id, event_type="device_alert", payload=payload))
            s.commit()
        alerts_total.labels(kind=kind).inc()
        log.warning("device alert", extra={"asset_id": code, "event": f"device_alert:{kind}"})
        await hub.broadcast({"event": "device_alert", "asset_id": code, "source": "watchdog",
                             "status": status, "kind": kind, "age_s": round(age, 1),
                             "timestamp": now().isoformat()})
        raised.append({"asset_id": code, **payload})
    return raised


async def watch_alerts() -> None:
    while True:
        await asyncio.sleep(CHECK_INTERVAL_S)
        try:
            await check_once()
        except Exception as e:
            log.warning(f"watchdog pass failed: {e}")
