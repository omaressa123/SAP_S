"""Structured JSON logging (Step 6): one JSON object per line on stdout.

Usage: `from services.logging import get_logger; log = get_logger(__name__)`
then `log.info("ingest accepted", extra={"asset_id": code})`.
`TWIN_LOG_LEVEL` (default INFO) controls verbosity.
"""
import json
import logging
import os
import sys
import traceback

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        obj = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("asset_id", "user", "command", "event", "source", "extra"):
            if hasattr(record, key):
                obj[key] = getattr(record, key)
        if record.exc_info and record.exc_info[0] is not None:
            obj["traceback"] = "".join(traceback.format_exception(*record.exc_info))
        return json.dumps(obj, default=str)


_configured = False

def setup() -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger("twin")
    root.handlers = [handler]
    root.setLevel(os.getenv("TWIN_LOG_LEVEL", "INFO").upper())
    root.propagate = False
    _configured = True


def get_logger(name: str) -> logging.Logger:
    setup()
    return logging.getLogger(f"twin.{name}")
