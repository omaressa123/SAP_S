"""Real ingest path (Step 4): sensor/gateway readings -> DB + WebSocket.

This is the production data path. It is fully separate from the Simulation
Service (`simulate()` / `run_robots()` in services/twin.py and
services/robots.py), which is gated behind TWIN_SIMULATION. Both paths emit
the same WebSocket contract; every broadcast carries `source` ("ingest" vs
"simulation") so clients and auditors can tell them apart.

Payload contract (single reading):
    {
      "asset_id": "CONV-001",          # required, must exist in twin_assets
      "status": "operational",         # optional status transition
      "health_score": 0.93,            # optional
      "telemetry": {"bags_processed": 250},  # optional free-form payload
      "position": {"x": 12.0, "y": 0, "z": -2.0},  # optional (robots/vehicles)
      "reason": "jam_cleared",         # optional, stored with status events
      "recorded_at": "2026-…Z"         # optional sensor timestamp (informational)
    }
"""
from pydantic import BaseModel, Field
from sqlalchemy import select

from models.db import Session, Asset, State, Event, RobotPose, now
from services.logging import get_logger
from services.twin import hub

log = get_logger("ingest")


class Position(BaseModel):
    x: float
    y: float = 0.0
    z: float


class Reading(BaseModel):
    asset_id: str = Field(min_length=1)
    status: str | None = None
    health_score: float | None = Field(default=None, ge=0.0, le=1.0)
    telemetry: dict = Field(default_factory=dict)
    position: Position | None = None
    reason: str | None = None
    recorded_at: str | None = None

    model_config = {"extra": "ignore"}


class UnknownAssetError(ValueError):
    pass


async def apply_reading(r: Reading) -> dict:
    """Persist one sensor reading and broadcast it. Raises UnknownAssetError."""
    from services.metrics import ingest_total
    with Session() as s:
        a = s.scalar(select(Asset).where(Asset.asset_code == r.asset_id))
        if not a:
            ingest_total.labels(result="rejected_unknown").inc()
            raise UnknownAssetError(f"unknown asset_id: {r.asset_id}")
        st = s.get(State, a.id)
        events: list[dict] = []
        if r.status is not None and r.status != st.status:
            st.status = r.status
            events.append({"event": "asset_status_changed", "status": r.status, "reason": r.reason})
            s.add(Event(asset_id=a.id, event_type="asset_status_changed",
                        payload={"status": r.status, "reason": r.reason, "source": "ingest"}))
        if r.health_score is not None:
            st.health_score = r.health_score
        st.updated_at, st.last_seen_at = now(), now()
        payload = dict(r.telemetry)
        if r.position is not None:
            payload["position"] = r.position.model_dump()
        if r.recorded_at is not None:
            payload["recorded_at"] = r.recorded_at
        if payload:
            events.append({"event": "asset_telemetry", "telemetry": payload})
            s.add(Event(asset_id=a.id, event_type="asset_telemetry",
                        payload={**payload, "source": "ingest"}))
        s.commit()
        ts = now().isoformat()

    # Robot/vehicle pose table: real positions flow into GET /robots too.
    if r.position is not None:
        from services import robots as robots_mod
        poses = robots_mod.poses
        prev = poses.get(r.asset_id, {"i": 0})
        poses[r.asset_id] = {**prev, "x": r.position.x, "z": r.position.z}
        with Session() as s:
            row = s.get(RobotPose, r.asset_id) or RobotPose(asset_code=r.asset_id)
            row.x, row.y, row.z = r.position.x, r.position.y, r.position.z
            row.updated_at = now()
            s.add(row); s.commit()

    out = {"asset_id": r.asset_id, "accepted": True, "timestamp": ts, "emitted": []}
    for e in events:
        msg = {"event": e["event"], "asset_id": r.asset_id, "source": "ingest",
               "status": e.get("status"), "reason": r.reason,
               "telemetry": e.get("telemetry"), "timestamp": ts}
        if r.position is not None:
            msg["position"] = {"x": r.position.x, "y": r.position.y, "z": r.position.z}
        await hub.broadcast(msg)
        out["emitted"].append(e["event"])
    if not events:
        # Heartbeat: nothing changed, but the device is alive (last_seen_at bumped).
        out["emitted"].append("heartbeat")
        ingest_total.labels(result="heartbeat").inc()
    else:
        ingest_total.labels(result="accepted").inc()
    log.info("reading applied", extra={"asset_id": r.asset_id,
                                       "emitted": ",".join(out["emitted"])})
    return out
