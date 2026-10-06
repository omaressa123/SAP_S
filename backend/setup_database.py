"""Database setup / verification for the Smart Airport backend (PostgreSQL).

Usage (run from backend/):
    python setup_database.py --check    verify reachability, DB identity,
                                        schema + model metadata match
    python setup_database.py --seed     check + create_all + seed + validate

Never falls back to SQLite and never touches any other database.
"""

import argparse
import sys

sys.path.insert(0, ".")

from sqlalchemy import inspect, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import Base, engine  # noqa: E402
from app.models import (  # noqa: E402,F401 register all tables
    identity, flights, check_in, baggage_security_screening, security,
    wayfinding, staff, admin_cameras, devices, sustainability,
)

EXPECTED_DB = "smart_airport"


def check(verbose=True):
    """Verify PostgreSQL reachability, identity, schema and metadata."""
    url = settings.DATABASE_URL
    if "postgresql" not in url:
        print(f"FAIL: DATABASE_URL is not PostgreSQL: {url.split('@')[-1]}")
        return False
    if "sqlite" in url:
        print("FAIL: SQLite fallback is not allowed.")
        return False
    ok = True
    try:
        with engine.connect() as c:
            db = c.execute(text("SELECT current_database()")).scalar()
            user = c.execute(text("SELECT current_user")).scalar()
            ver = c.execute(text("SELECT version()")).scalar()
            schema = c.execute(text("SELECT current_schema()")).scalar()
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: cannot connect: {exc}")
        return False
    if verbose:
        print(f"database = {db}")
        print(f"user     = {user}")
        print(f"schema   = {schema}")
        print(f"version  = {str(ver)[:70]}")
        print(f"dialect  = {engine.dialect.name} | driver = {engine.dialect.driver}")
    if db != EXPECTED_DB:
        print(f"FAIL: connected to '{db}', expected '{EXPECTED_DB}'")
        ok = False
    if engine.dialect.name != "postgresql" or engine.dialect.driver != "psycopg":
        print("FAIL: expected postgresql+psycopg dialect/driver")
        ok = False
    insp = inspect(engine)
    actual = set(insp.get_table_names(schema="public"))
    expected = set(Base.metadata.tables.keys())
    missing = expected - actual
    extra = actual - expected
    if verbose:
        print(f"model tables   = {len(expected)}")
        print(f"present tables = {len(actual & expected)}")
    if missing:
        print(f"FAIL: missing tables: {sorted(missing)}")
        ok = False
    if extra and verbose:
        print(f"note: non-model tables in public schema: {sorted(extra)}")
    print("CHECK " + ("PASS" if ok else "FAIL"))
    return ok


def seed():
    """check -> create_all -> seed_demo_data -> validate counts."""
    Base.metadata.create_all(bind=engine)
    if not check(verbose=True):
        return False
    from seed_demo_data import seed_all  # noqa: E402 (needs tables first)
    seed_all()
    return check(verbose=False)


def main():
    ap = argparse.ArgumentParser(description="Smart Airport DB setup")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--check", action="store_true")
    g.add_argument("--seed", action="store_true")
    args = ap.parse_args()
    ok = check() if args.check else seed()
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
