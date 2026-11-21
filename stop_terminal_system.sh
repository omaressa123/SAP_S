#!/usr/bin/env bash
# Smart Airport System — Terminal Stop Script
echo "Stopping Smart Airport terminal processes..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 8100/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
echo "All terminal airport services stopped."
