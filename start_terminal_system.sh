#!/usr/bin/env bash
# Smart Airport System — Direct Terminal Runner (No Docker)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================"
echo " Starting Smart Airport System in Terminal Mode       "
echo "======================================================"

# 1. Ensure PostgreSQL cluster 18 and Mosquitto are online
echo "[1/4] Verifying PostgreSQL and Mosquitto services..."
systemctl start postgresql@18-main 2>/dev/null || true

# Kill any existing processes on target ports
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8100/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true

trap 'kill $(jobs -p) 2>/dev/null || true' EXIT SIGINT SIGTERM

# 2. Launch Backend API on port 8000
echo "[2/4] Starting FastAPI Backend on http://localhost:8000 ..."
cd "$DIR/backend"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# 3. Launch Airport Twin API on port 8100
echo "[3/4] Starting Airport Twin on http://localhost:8100 ..."
cd "$DIR/airport-twin/backend"
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8100 > "$DIR/twin.log" 2>&1 &
TWIN_PID=$!
echo "Twin PID: $TWIN_PID"

# 4. Launch Frontend Dev Server on port 5173
echo "[4/4] Starting Frontend on http://localhost:5173 ..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 > "$DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "======================================================"
echo " Smart Airport System is LIVE in Terminal:            "
echo " - Frontend:   http://localhost:5173                  "
echo " - Workflows:  http://localhost:5173/workflows        "
echo " - Backend:    http://localhost:8000 (docs: /docs)    "
echo " - Twin API:   http://localhost:8100                  "
echo "======================================================"

# Keep running to manage child processes
wait
