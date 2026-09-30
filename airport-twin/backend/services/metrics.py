"""Prometheus metrics (Step 6): devices, message rate, API latency.

Scrape at GET /metrics (unauthenticated: intended for the cluster network).
"""
from prometheus_client import Counter, Gauge, Histogram, CONTENT_TYPE_LATEST, generate_latest

ws_clients = Gauge("twin_ws_clients", "Currently connected WebSocket clients")

broadcasts_total = Counter(
    "twin_broadcasts_total", "WebSocket messages broadcast", ["event", "source"])

ingest_total = Counter(
    "twin_ingest_total", "Readings accepted via POST /ingest", ["result"])
# result: accepted | heartbeat | rejected_unknown | rejected_validation

api_latency = Histogram(
    "twin_api_latency_seconds", "REST API latency", ["method", "route"])

alerts_total = Counter(
    "twin_alerts_total", "Device alerts raised by the watchdog", ["kind"])
# kind: offline | stale | critical


def render() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
