"""Schema migrations + DB connection retry/backoff (Step 5).

Runtime (and tests) apply `alembic upgrade head` — no more bare create_all.
"""
import os
import pathlib
import time

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

BASE_DIR = pathlib.Path(__file__).resolve().parent.parent  # backend/


def _config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL", "sqlite:///twin.db"))
    return cfg


def wait_for_db(tries: int = 30) -> None:
    """Retry the first connection with exponential backoff (cold Postgres, etc.)."""
    url = os.getenv("DATABASE_URL", "sqlite:///twin.db")
    last: Exception | None = None
    for attempt in range(tries):
        try:
            eng = create_engine(url, pool_pre_ping=True)
            with eng.connect():
                return
        except OperationalError as e:
            last = e
            time.sleep(min(2.0, 0.2 * (2 ** attempt)))
    raise RuntimeError(f"database unreachable after {tries} tries: {url}") from last


def upgrade() -> None:
    wait_for_db()
    command.upgrade(_config(), "head")
