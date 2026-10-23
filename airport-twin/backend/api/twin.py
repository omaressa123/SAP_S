from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from models.db import Session, Asset, State, Event, Location, RobotPose, now
from services.config import SIMULATION_ENABLED
from services.ingest import Reading, UnknownAssetError, apply_reading
from services.logging import get_logger
from services.robots import ROBOTS, poses
from services.twin import META, FLIGHTS, fids_board, hub

router = APIRouter()
log = get_logger("api")

def row(a, st, loc):
    return {"asset_id": a.asset_code, "asset_type": a.asset_type, "name": a.name, "model_path": a.model_key,
            "location": loc.name, "floor": loc.floor, "status": st.status, "health_score": st.health_score,
            "last_update": st.updated_at.isoformat(), "metadata": META.get(a.asset_code, {})}

def query():
    return select(Asset, State, Location).join(State, State.asset_id == Asset.id).join(Location, Location.id == Asset.location_id)

# --- readers: all routes are unauthenticated (internal admin system) ---

@router.get("/assets")
def assets():
    with Session() as s: return [row(*r) for r in s.execute(query().where(Asset.is_active))]

@router.get("/assets/{code}")
def asset(code: str):
    with Session() as s:
        r = s.execute(query().where(Asset.asset_code == code)).first()
        if not r: raise HTTPException(404, "asset not found")
        return row(*r)

@router.get("/assets/{code}/events")
def events(code: str, limit: int = 50):
    with Session() as s:
        a = s.scalar(select(Asset).where(Asset.asset_code == code))
        if not a: raise HTTPException(404, "asset not found")
        ev = s.scalars(select(Event).where(Event.asset_id == a.id).order_by(Event.created_at.desc()).limit(limit))
        return [{"event_type": e.event_type, "payload": e.payload, "created_at": e.created_at.isoformat()} for e in ev]

@router.get("/robots")
def robots():
    with Session() as s:
        dbposes = {r.asset_code: (r.x, r.z) for r in s.scalars(select(RobotPose))}
    out = []
    for c, r in ROBOTS.items():
        if c in dbposes: x, z = dbposes[c]
        elif c in poses: x, z = poses[c]["x"], poses[c]["z"]
        else: continue
        out.append({"asset_id": c, "target": r["target"], "speed": r["speed"],
                    "position": {"x": x, "y": 0, "z": z}})
    return out

@router.get("/flights")
def flights():
    return fids_board()

@router.get("/fids")
def fids():
    return {"departures": fids_board()}

@router.get("/mode")
def mode():
    """Which data path is driving the twin: simulation service or real ingest."""
    return {"simulation": SIMULATION_ENABLED,
            "source": "simulation" if SIMULATION_ENABLED else "ingest"}

# --- writers: all routes are unauthenticated (internal admin system) ---

class Batch(BaseModel):
    readings: list[Reading]

@router.post("/ingest", status_code=202)
async def ingest(reading: Reading):
    """Real sensor/gateway reading -> twin_asset_state + WebSocket broadcast."""
    try:
        return await apply_reading(reading)
    except UnknownAssetError as e:
        raise HTTPException(404, str(e))

@router.post("/ingest/batch", status_code=202)
async def ingest_batch(batch: Batch):
    """Batch ingest; per-item results so one bad reading can't sink the batch."""
    accepted, errors = [], []
    for r in batch.readings:
        try:
            accepted.append(await apply_reading(r))
        except UnknownAssetError as e:
            errors.append({"asset_id": r.asset_id, "error": str(e)})
    return {"accepted": accepted, "errors": errors}

class Command(BaseModel):
    command: str
    params: dict = {}

@router.post("/assets/{code}/command", status_code=202)
async def command(code: str, cmd: Command):
    """Device command with a full audit trail (Step 5): who, when, what, result.

    Delivery: accepted into the Simulation Service loop in sim mode, or queued
    for the device gateway when real ingest drives the twin.
    """
    with Session() as s:
        a = s.scalar(select(Asset).where(Asset.asset_code == code))
        if not a: raise HTTPException(404, "asset not found")
        via = "simulation" if SIMULATION_ENABLED else "gateway"
        payload = {"command": cmd.command, "params": cmd.params, "result": "accepted", "via": via}
        s.add(Event(asset_id=a.id, event_type="asset_command", payload=payload))
        s.commit()
        ts = now().isoformat()
    await hub.broadcast({"event": "asset_command", "asset_id": code, "source": "command",
                         "command": cmd.command, "params": cmd.params,
                         "result": "accepted", "via": via, "timestamp": ts})
    log.info("device command", extra={"asset_id": code, "command": cmd.command})
    return {"asset_id": code, "command": cmd.command, "result": "accepted",
            "via": via, "timestamp": ts}

@router.get("/admin/ping")
def admin_ping():
    return {"pong": True}
