import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text
from api.twin import router
from models.db import Session
from services.alerts import watch_alerts
from services.auth import decode_token
from services.config import SIMULATION_ENABLED
from services.logging import get_logger
from services.metrics import api_latency, render as render_metrics, ws_clients
from services.robots import run_robots
from services.twin import seed, simulate, hub

log = get_logger("main")

@asynccontextmanager
async def lifespan(_):
    seed()
    tasks = [asyncio.create_task(watch_alerts())]
    if SIMULATION_ENABLED:
        # Simulation Service: drives telemetry/flight phases/robot motion.
        # With TWIN_SIMULATION=false this stays off and POST /api/twin/ingest
        # is the only writer — same WebSocket contract either way.
        tasks += [asyncio.create_task(simulate()), asyncio.create_task(run_robots())]
    log.info(f"data path: {'simulation' if SIMULATION_ENABLED else 'real ingest (simulation OFF)'}")
    yield
    [t.cancel() for t in tasks]

app = FastAPI(title="Airport Twin API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router, prefix="/api/twin")

@app.middleware("http")
async def latency_middleware(request: Request, call_next):
    start = time.perf_counter()
    resp = await call_next(request)
    route = request.scope.get("route")
    template = getattr(route, "path", None) or request.url.path
    api_latency.labels(method=request.method, route=template).observe(time.perf_counter() - start)
    return resp

@app.get("/health")
def health():
    """Liveness probe (unauthenticated by design)."""
    return {"status": "ok"}

@app.get("/ready")
def ready():
    """Readiness probe (unauthenticated by design): DB reachable + schema migrated."""
    try:
        with Session() as s:
            s.execute(text("SELECT 1 FROM twin_assets LIMIT 1"))
        return {"ready": True, "simulation": SIMULATION_ENABLED}
    except Exception as e:
        raise HTTPException(503, f"not ready: {e}")

@app.get("/metrics")
def metrics():
    """Prometheus scrape endpoint (unauthenticated: cluster network)."""
    body, ctype = render_metrics()
    return Response(content=body, media_type=ctype)

@app.websocket("/ws/twin")
async def ws_twin(ws: WebSocket):
    # Step 5: the socket needs the same JWT as REST (?token=<jwt>).
    try:
        user = decode_token(ws.query_params.get("token", ""))
    except Exception:
        await ws.close(code=4401)
        return
    await ws.accept(); hub.clients.add(ws); ws_clients.inc()
    log.info(f"ws connected ({len(hub.clients)} clients)", extra={"user": user.username})
    try:
        while True: await ws.receive_text()
    except WebSocketDisconnect: pass
    finally:
        hub.clients.discard(ws); ws_clients.dec()
