import asyncio, math
from sqlalchemy import select
from models.db import Session, Asset, State, RobotPose, now
from services.twin import hub

# Robot Controller (prototype). Replace `run_robots` with real IoT/controller input later; the WebSocket contract stays.
ROBOTS = {"RB-007": {"target": "BAGGAGE-ZONE-02", "speed": 1.2,
                     "route": [(4.2, 12.4), (12, 12.4), (12, -2), (4.2, -2)]}}
poses: dict = {}

def status_of(code):
    with Session() as s:
        return s.scalar(select(State.status).join(Asset, Asset.id == State.asset_id).where(Asset.asset_code == code))

def save_pose(code, x, z):
    """Persist last-known pose (Step 5): survives restarts, feeds GET /robots."""
    with Session() as s:
        row = s.get(RobotPose, code) or RobotPose(asset_code=code)
        row.x, row.z, row.updated_at = x, z, now()
        s.add(row); s.commit()

def load_pose(code):
    with Session() as s:
        row = s.get(RobotPose, code)
        return (row.x, row.z) if row else None

def advance(p, r, dist):
    for _ in range(len(r["route"])):
        tx, tz = r["route"][p["i"]]; d = math.hypot(tx - p["x"], tz - p["z"])
        if d <= dist: p["x"], p["z"], dist, p["i"] = tx, tz, dist - d, (p["i"] + 1) % len(r["route"])
        else: p["x"] += (tx - p["x"]) / d * dist; p["z"] += (tz - p["z"]) / dist * dist; return

async def run_robots(hz: int = 4):
    for c, r in ROBOTS.items():
        start = load_pose(c) or r["route"][0]
        poses[c] = {"i": 1, "x": start[0], "z": start[1]}
    while True:
        await asyncio.sleep(1 / hz)
        for c, r in ROBOTS.items():
            ok = status_of(c) == "operational"
            if ok:
                advance(poses[c], r, r["speed"] / hz)
                save_pose(c, poses[c]["x"], poses[c]["z"])
            await hub.broadcast({"event": "robot_position_updated", "asset_id": c, "status": "moving" if ok else "stopped",
                                 "position": {"x": poses[c]["x"], "y": 0, "z": poses[c]["z"]}, "target": r["target"],
                                 "speed": r["speed"] if ok else 0, "timestamp": now().isoformat(), "source": "simulation"})
