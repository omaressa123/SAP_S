from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Adapt postgresql+psycopg:// to postgresql+psycopg2:// if psycopg v3 is not installed
effective_db_url = settings.DATABASE_URL
if effective_db_url.startswith("postgresql+psycopg://"):
    try:
        import psycopg  # noqa: F401
    except ImportError:
        effective_db_url = effective_db_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)

# For SQLite, we need connect_args={"check_same_thread": False}
connect_args = {"check_same_thread": False} if "sqlite" in effective_db_url else {}
engine_kwargs = {"connect_args": connect_args}
if "postgresql" in effective_db_url:
    # Production hardening: recycle stale pooled connections.
    engine_kwargs.update(pool_pre_ping=True, pool_size=10, max_overflow=20)

engine = create_engine(effective_db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Register every model module AFTER Base exists (models import Base from
# here, so this must stay below its definition). Ensures cross-module FK
# targets resolve for all entrypoints (uvicorn, init_db, mqtt_consumer).
from . import models as _models  # noqa: F401,E402

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
