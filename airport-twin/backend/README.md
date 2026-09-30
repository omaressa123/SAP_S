# Airport Twin — Backend (production notes, Step 5)

## Run

```bash
cd backend
../.venv/bin/python -m uvicorn main:app --port 8000
```

## Auth (JWT + RBAC)

Every `/api/twin/*` route requires a Bearer token except `/auth/token`.
WebSocket needs `?token=<jwt>`. Only `/health` and `/ready` are open (probes).

Roles: `viewer` (read) < `operator` (ingest + device commands) < `admin` (all).

```bash
# login
curl -s -X POST localhost:8000/api/twin/auth/token \
  -d 'username=operator&password=op123' | python3 -m json.tool
# use it
T=...; curl -s localhost:8000/api/twin/assets -H "Authorization: Bearer $T" | head -c 200
# audited device command (operator+)
curl -s -X POST localhost:8000/api/twin/assets/CONV-001/command \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"command":"belt_stop","params":{"reason":"jam"}}'
```

Users come from `TWIN_USERS="admin:s3cret:admin,op:s3cret:operator,view:s3cret:viewer"`.
Without it, dev defaults apply (`admin/admin123`, `operator/op123`, `viewer/view123`)
with a startup warning — **set TWIN_USERS + TWIN_JWT_SECRET in production**.
Token TTL: 12 h. Every command is audit-logged to `twin_asset_events`
(`event_type = asset_command`: who, when, what, params, result).

## TLS (mandatory in production)

Terminate TLS in front of uvicorn (reverse proxy) or directly:

```bash
../.venv/bin/python -m uvicorn main:app --port 8000 \
  --ssl-keyfile /etc/ssl/twin.key --ssl-certfile /etc/ssl/twin.crt
```

The web client already upgrades to `wss://` automatically on `https:` pages.

## Postgres + Alembic migrations

```bash
export DATABASE_URL="postgresql+psycopg://twin:secret@db:5432/twin"
```

Schema is applied with **Alembic** (`alembic/versions/`, `services/migrate.py`),
never bare `create_all` — on boot (`upgrade head`) with connection
retry/backoff (`wait_for_db`, ~30 tries). Run migrations separately in prod:

```bash
DATABASE_URL=... ../.venv/bin/python -c "from services.migrate import upgrade; upgrade()"
```

SQLite (`sqlite:///twin.db`) stays the zero-setup dev default. Robot last-known
positions live in the `robot_positions` table, so they survive restarts.

## Data path

`TWIN_SIMULATION=true` (default): built-in sim drives telemetry/flights/robots.
`TWIN_SIMULATION=false`: sim loops never start; sensors drive the twin via
`POST /api/twin/ingest` (operator+). Same WebSocket contract; every message
carries `source` (`simulation` / `ingest` / `command`).

## Probes

- `GET /health` → `{"status":"ok"}` (liveness, open)
- `GET /ready` → `{"ready":true,…}` or HTTP 503 (DB + schema check, open)

## Observability (Step 6)

- **Logs:** one JSON object per line on stdout (`services/logging.py`;
  `TWIN_LOG_LEVEL`, default INFO). No `print()` in the serving path.
- **Metrics:** `GET /metrics` (Prometheus, open for the cluster network):
  `twin_ws_clients`, `twin_broadcasts_total{event,source}`,
  `twin_ingest_total{result}`, `twin_api_latency_seconds{method,route}`,
  `twin_alerts_total{kind}`.
- **Alerting:** the watchdog (`services/alerts.py`, always on) scans
  `twin_asset_state` and raises `device_alert` (DB event + WebSocket +
  log + metric) for `offline` / `critical` / stale (`last_seen_at` older
  than `TWIN_OFFLINE_AFTER_S`, default 300 s), with per-asset cooldown
  (`TWIN_ALERT_COOLDOWN_S`, default 900 s; interval `TWIN_ALERT_INTERVAL_S`,
  default 30 s). The client surfaces alerts in the asset list like status
  changes.

## Testing

```bash
../.venv/bin/python -m pytest tests/ -q   # unit + integration (21 tests)
../.venv/bin/python smoke_test.py --base http://host:8000 --user operator --password op123
```

`smoke_test.py` is the post-deploy gate: probes, auth, every reader 200,
ingest 202, metrics, and an authenticated WebSocket connect. The integration
test (`tests/test_integration.py`) proves ingest POST → live WebSocket
delivery over a real socket.
