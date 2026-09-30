#!/usr/bin/env python3
"""Deploy smoke test (Step 6): every endpoint 200 + WebSocket connects.

Usage:
    python smoke_test.py --base http://host:8000 --user operator --password op123

Exit 0 when the deployment serves; non-zero with the failing check printed.
Needs only stdlib (+ `websockets` package for the WS check; skipped if absent).
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

FAIL = []


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        FAIL.append(name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--user", default="operator")
    ap.add_argument("--password", default="op123")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    def get(path, token=None):
        req = urllib.request.Request(base + path)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def post(path, body, token=None, form=False):
        data = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        req = urllib.request.Request(base + path, data=data, method="POST")
        req.add_header("Content-Type",
                       "application/x-www-form-urlencoded" if form else "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    s, b = get("/health")
    check("GET /health", s == 200 and json.loads(b)["status"] == "ok", f"got {s}")

    s, b = get("/ready")
    check("GET /ready", s == 200 and json.loads(b).get("ready") is True, f"got {s}")

    s, _ = get("/api/twin/assets")
    check("anonymous REST rejected", s == 401, f"got {s}")

    s, b = post("/api/twin/auth/token", {"username": args.user, "password": args.password}, form=True)
    token = json.loads(b).get("access_token") if s == 200 else None
    check("login", bool(token), f"got {s}")

    for path in ("/api/twin/assets", "/api/twin/flights", "/api/twin/fids",
                 "/api/twin/robots", "/api/twin/mode", "/api/twin/auth/me"):
        s, _ = get(path, token)
        check(f"GET {path}", s == 200, f"got {s}")

    s, _ = get("/metrics")
    check("GET /metrics", s == 200, f"got {s}")

    s, _ = post("/api/twin/ingest", {"asset_id": "SNS-001", "telemetry": {"smoke": 1}}, token)
    check("POST /ingest", s == 202, f"got {s}")

    try:
        import websockets  # type: ignore
        import asyncio

        async def ws_ok():
            url = base.replace("http", "ws") + f"/ws/twin?token={token}"
            async with websockets.connect(url):
                return True

        check("WS connect (auth)", asyncio.run(ws_ok()))
    except ImportError:
        print("SKIP WS connect (websockets package absent)")

    print("SMOKE " + ("OK" if not FAIL else f"FAILED: {FAIL}"))
    return 1 if FAIL else 0


if __name__ == "__main__":
    import urllib.error
    sys.exit(main())
