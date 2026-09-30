import asyncio, json, random, pathlib
from sqlalchemy import select
from models.db import Session, Asset, State, Event, Location, RobotPose, now
from services.migrate import upgrade

REGISTRY = pathlib.Path(__file__).parents[2] / "apps/web-client/public/assets/registry.json"
STATUSES = ["operational", "offline", "maintenance", "warning", "critical", "unknown"]
REASONS = {"offline": "motor_failure", "critical": "overheat", "warning": "vibration_high",
           "maintenance": "scheduled_service", "operational": "recovered", "unknown": "no_signal"}

class Hub:
    def __init__(self): self.clients = set()
    async def broadcast(self, msg):
        try:
            from services.metrics import broadcasts_total
            broadcasts_total.labels(event=msg.get("event", "?"),
                                    source=msg.get("source", "?")).inc()
        except Exception:
            pass
        for ws in list(self.clients):
            try: await ws.send_json(msg)
            except Exception: self.clients.discard(ws)
hub = Hub()

def seed():
    upgrade()  # Alembic migrations (Step 5) — never bare create_all.
    with Session() as s:
        locs = {l.name: l for l in s.scalars(select(Location))}
        have = set(s.scalars(select(Asset.asset_code)))  # adds only missing assets
        for a in json.loads(REGISTRY.read_text()):
            if a["asset_id"] in have: continue
            if a["location"] not in locs:
                locs[a["location"]] = Location(name=a["location"], floor=a["floor"], zone_type=a["zone_type"])
                s.add(locs[a["location"]]); s.flush()
            row = Asset(asset_code=a["asset_id"], asset_type=a["asset_type"], name=a["name"],
                        model_key=a["model_path"], location_id=locs[a["location"]].id)
            s.add(row); s.flush()
            s.add(State(asset_id=row.id, status=a["status"]))
        # Seed robot start poses (route heads) so GET /robots works pre-motion.
        from services.robots import ROBOTS
        for code, r in ROBOTS.items():
            if not s.get(RobotPose, code):
                x, z = r["route"][0]
                s.add(RobotPose(asset_code=code, x=x, y=0.0, z=z))
        s.commit()

async def set_status(code: str, status: str, reason: str | None = None):
    with Session() as s:
        a = s.scalar(select(Asset).where(Asset.asset_code == code))
        if not a: return
        st = s.get(State, a.id); st.status, st.updated_at, st.last_seen_at = status, now(), now()
        s.add(Event(asset_id=a.id, event_type="asset_status_changed", payload={"status": status, "reason": reason}))
        s.commit()
    await hub.broadcast({"event": "asset_status_changed", "asset_id": code, "status": status,
                         "reason": reason, "timestamp": now().isoformat(), "source": "simulation"})

META = {
 "AIRCRAFT-001": {"gate": "A12", "flight": "MS123", "destination": "Cairo (CAI)", "passengers": 178, "fuel_pct": 82, "type": "A320neo class, single-aisle"},
 "AIRCRAFT-002": {"gate": "B14", "flight": "SM456", "destination": "Dubai (DXB)", "passengers": 164, "fuel_pct": 74, "type": "A320 class, single-aisle"},
 "AIRCRAFT-003": {"gate": "C16", "flight": "BA789", "destination": "London (LHR)", "passengers": 189, "fuel_pct": 91, "type": "B737-800 class, single-aisle"},
 "AIRCRAFT-004": {"gate": "--", "flight": "MS321", "destination": "Jeddah (JED)", "passengers": 172, "fuel_pct": 64, "type": "A321neo, airborne departure"},
 "JETBRIDGE-001": {"gate": "A12", "docked": True},
 "JETBRIDGE-002": {"gate": "B14", "docked": True},
 "JETBRIDGE-003": {"gate": "C16", "docked": False},
 "CONV-001": {"speed_m_s": 1.8, "bags_processed": 243},
 "CONV-002": {"speed_m_s": 1.6, "bags_processed": 187},
 "CAM-021": {"fps": 25, "location": "Apron Stand A12", "last_detection": "Passenger"},
 "CAM-001": {"fps": 25, "location": "Security Gate", "last_detection": "Queue length 6"},
 "CAM-002": {"fps": 25, "location": "Gates A01-A03", "last_detection": "Boarding"},
 "GATE-A01": {"flight": "MS123", "boarding": "18:40"}, "GATE-A02": {"flight": "MS456", "boarding": "19:15"},
 "GATE-A03": {"flight": "MS789", "boarding": "20:05"},
}

# Real ops system: flight phases cycle per aircraft (SCHEDULED->BOARDING->PUSHBACK->TAXI->DEPARTED->AIRBORNE->ARRIVED)
FLIGHTS = {
 "MS123": {"flight": "MS123", "aircraft": "AIRCRAFT-001", "origin": "CAI", "destination": "CAI",
           "stand": "A12", "gate": "GATE-A01", "phase": "BOARDING", "pax": 178, "fuel_pct": 82, "bags": 243},
 "SM456": {"flight": "SM456", "aircraft": "AIRCRAFT-002", "origin": "DXB", "destination": "DXB",
           "stand": "B14", "gate": "GATE-A02", "phase": "BOARDING", "pax": 164, "fuel_pct": 74, "bags": 187},
 "BA789": {"flight": "BA789", "aircraft": "AIRCRAFT-003", "origin": "LHR", "destination": "LHR",
           "stand": "C16", "gate": "GATE-A03", "phase": "SCHEDULED", "pax": 189, "fuel_pct": 91, "bags": 201},
 "MS321": {"flight": "MS321", "aircraft": "AIRCRAFT-004", "origin": "JED", "destination": "JED",
           "stand": "--", "gate": "--", "phase": "AIRBORNE", "pax": 172, "fuel_pct": 64, "bags": 0},
}
PHASES = ["SCHEDULED", "BOARDING", "PUSHBACK", "TAXI", "DEPARTED", "AIRBORNE", "ARRIVED"]

def fids_board():
    return [{"flight": f["flight"], "destination": f["destination"], "stand": f["stand"],
             "gate": f["gate"], "phase": f["phase"], "pax": f["pax"], "fuel_pct": f["fuel_pct"]}
            for f in FLIGHTS.values()]

async def simulate(period: float = 10.0):
    """Simulation Service: random failures/recoveries + live telemetry ticks."""
    tick = 0
    while True:
        await asyncio.sleep(period)
        tick += 1
        with Session() as s: codes = s.scalars(select(Asset.asset_code)).all()
        # live telemetry tick for conveyors / aircraft fuel (visible real-time updates)
        for conv in ("CONV-001", "CONV-002"):
            if conv in codes and tick % 2 == 0:
                m = META[conv]; m["bags_processed"] += random.randint(3, 12)
                await hub.broadcast({"event": "asset_telemetry", "asset_id": conv, "status": None,
                                     "telemetry": {"bags_processed": m["bags_processed"], "speed_m_s": m["speed_m_s"]},
                                     "timestamp": now().isoformat(), "source": "simulation"})
        if "AIRCRAFT-001" in codes and tick % 3 == 0:
            m = META["AIRCRAFT-001"]; m["fuel_pct"] = max(5, m["fuel_pct"] - random.randint(0, 1))
            await hub.broadcast({"event": "asset_telemetry", "asset_id": "AIRCRAFT-001", "status": None,
                                 "telemetry": {"fuel_pct": m["fuel_pct"], "passengers": m["passengers"]},
                                 "timestamp": now().isoformat(), "source": "simulation"})
        # Flight-phase state machine: advance each flight every few ticks, broadcast FIDS + aircraft telemetry
        if tick % 4 == 0:
            for code, f in FLIGHTS.items():
                if random.random() < 0.45:
                    i = PHASES.index(f["phase"])
                    f["phase"] = PHASES[(i + 1) % len(PHASES)]
                    if f["phase"] == "BOARDING":
                        f["pax"] = min(189, f["pax"] + random.randint(2, 9))
                    if f["phase"] in ("TAXI", "DEPARTED"):
                        f["fuel_pct"] = max(5, f["fuel_pct"] - random.randint(1, 2))
                    ac = f["aircraft"]
                    if ac in META:
                        META[ac].update({"flight": f["flight"], "phase": f["phase"],
                                         "passengers": f["pax"], "fuel_pct": f["fuel_pct"]})
                    await hub.broadcast({"event": "asset_telemetry", "asset_id": ac, "status": None,
                                         "telemetry": {"flight": f["flight"], "phase": f["phase"],
                                                       "fuel_pct": f["fuel_pct"], "passengers": f["pax"]},
                                         "timestamp": now().isoformat(), "source": "simulation"})
            await hub.broadcast({"event": "fids_updated", "asset_id": "FIDS-001", "status": None,
                                 "telemetry": {"board": fids_board()}, "timestamp": now().isoformat(),
                                 "source": "simulation"})
        st = random.choices(STATUSES, weights=[6, 1, 1, 2, 1, 0.3])[0]
        await set_status(random.choice(codes), st, REASONS[st])
