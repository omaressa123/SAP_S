import os, uuid, datetime as dt
from sqlalchemy import create_engine, String, Integer, Boolean, Float, ForeignKey, JSON, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.dialects.postgresql import JSONB

engine = create_engine(os.getenv("DATABASE_URL", "sqlite:///twin.db"), pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)
uid = lambda: str(uuid.uuid4())
now = lambda: dt.datetime.now(dt.timezone.utc)

class Base(DeclarativeBase): pass

class Location(Base):
    __tablename__ = "twin_locations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String, unique=True)
    floor: Mapped[int] = mapped_column(Integer, default=0)
    zone_type: Mapped[str] = mapped_column(String)

class Asset(Base):
    __tablename__ = "twin_assets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    asset_code: Mapped[str] = mapped_column(String, unique=True)
    asset_type: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    model_key: Mapped[str] = mapped_column(String)
    location_id: Mapped[str] = mapped_column(ForeignKey("twin_locations.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class State(Base):
    __tablename__ = "twin_asset_state"
    asset_id: Mapped[str] = mapped_column(ForeignKey("twin_assets.id"), primary_key=True)
    status: Mapped[str] = mapped_column(String, default="unknown")
    health_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)

class Event(Base):
    __tablename__ = "twin_asset_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    asset_id: Mapped[str] = mapped_column(ForeignKey("twin_assets.id"))
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)

class RobotPose(Base):
    """Last known robot position — survives restarts (Step 5)."""
    __tablename__ = "robot_positions"
    asset_code: Mapped[str] = mapped_column(String, primary_key=True)
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    z: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
