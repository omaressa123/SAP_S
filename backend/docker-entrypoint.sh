#!/bin/sh
set -e
# Entrypoint honored only when running the API server (uvicorn in CMD).
# The mqtt-consumer service overrides CMD, so no DB init runs there.
if [ "$1" = "uvicorn" ]; then
  echo "[backend] initializing PostgreSQL schema..."
  python init_db.py
fi
echo "[backend] starting: $*"
exec "$@"
