#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Force CPU-only and silence TensorFlow/CUDA warnings at the process level
export CUDA_VISIBLE_DEVICES="-1"
export TF_CPP_MIN_LOG_LEVEL="1"
export TF_ENABLE_ONEDNN_OPTS="0"
export TF_USE_LEGACY_KERAS="1"

source .venv/bin/activate
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
