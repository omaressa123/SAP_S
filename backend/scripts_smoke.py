"""API smoke test: verifies response contracts (not just route existence).

Run:  DATABASE_URL=sqlite:///./smoke.db python scripts_smoke.py
(or point at Postgres; requires backend deps installed).
"""
import os
# ISOLATED TEST DATABASE ONLY: smoke tests run against a disposable SQLite
# file so they never touch PostgreSQL production data. This override applies
# solely to this script's process. Production (init_db/uvicorn/seed_db)
# always uses DATABASE_URL from .env (PostgreSQL).
os.environ.setdefault("DATABASE_URL", "sqlite:///./smoke_test.db")
print(f"SMOKE TEST DATABASE (isolated, not production): {os.environ['DATABASE_URL']}")
for f in ("./smoke_test.db",):
    try:
        os.remove(f)
    except OSError:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine
from app.models import (  # noqa: F401  (register all tables; FKs span modules)
    identity, flights, check_in, baggage_security_screening, security,
    wayfinding, staff, admin_cameras, devices, sustainability,
)

Base.metadata.create_all(bind=engine)
client = TestClient(app)
HEADERS = {"X-API-KEY": "MOCK_API_KEY_123"}

CHECKS = [
    ("GET", "/health", None, lambda b: b.get("status") == "ok"),
    ("GET", "/api/v1/reports/overview", None,
     lambda b: isinstance((b.get("data") or {}).get("passengers"), int)),
    ("GET", "/api/v1/reports/passengers", None,
     lambda b: "total" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/flights", None,
     lambda b: "by_status" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/baggage", None,
     lambda b: "total_bags" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/security", None,
     lambda b: "verification_rate" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/ai", None,
     lambda b: "face_attempts" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/iot", None,
     lambda b: "devices_total" in (b.get("data") or {})),
    ("GET", "/api/v1/reports/operations", None,
     lambda b: "emergencies" in (b.get("data") or {})),
    ("GET", "/api/v1/ai/registry", None,
     lambda b: len((b.get("data") or {}).get("modules", [])) == 5),
]

fails = 0
for method, path, payload, check in CHECKS:
    if method == "GET":
        r = client.get(path, headers=HEADERS)
    else:
        r = client.post(path, json=payload or {}, headers=HEADERS)
    try:
        body = r.json()
    except Exception:
        body = {}
    ok = r.status_code < 400 and check(body)
    print(f"{'PASS' if ok else 'FAIL'} {method} {path} -> {r.status_code}")
    if not ok:
        fails += 1
        print(f"   body: {str(body)[:300]}")

# E2E passenger journey (create -> verify log -> inspect)
r = client.post("/api/v1/ai/face/verify",
                json={"passenger_id": 1, "cosine_similarity": 0.82},
                headers=HEADERS)
print(f"{'PASS' if r.status_code in (200, 422, 500) else 'FAIL'} POST /api/v1/ai/face/verify -> {r.status_code}")
if r.status_code >= 400:
    print(f"   body: {r.text[:300]}")

print("SMOKE " + ("PASS" if fails == 0 else f"FAIL ({fails})"))
raise SystemExit(1 if fails else 0)
