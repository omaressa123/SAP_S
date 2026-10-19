"""Pytest fixtures for agent layer tests.

Uses an isolated SQLite database so tests never touch production PostgreSQL.
"""
import os
import sys

# Force isolated test database BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite:///./test_agent_system.db"

# Remove stale test db
try:
    os.remove("./test_agent_system.db")
except OSError:
    pass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import (  # noqa: F401
    identity, flights, check_in, baggage_security_screening, security,
    wayfinding, staff, admin_cameras, devices, sustainability, agents,
)

Base.metadata.create_all(bind=engine)

# Override the dependency to use the test session
def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[__import__("app.database", fromlist=["get_db"]).get_db] = override_get_db

# Initialize agent service so endpoints work under TestClient
from app.agents.service import agent_service
agent_service.init(
    face_service_url="http://localhost:8001",
    baggage_backend_url="http://localhost:8000/api/v1/ai/baggage/analyze",
    btd_inference_url="http://localhost:8002",
    smoke_fire_url="http://localhost:8003",
    fall_detection_url="http://localhost:8004",
    twin_base_url="http://localhost:8100",
)

# Mock the twin publisher so tests do not make real HTTP calls to a service
# that is not running in the test environment. The twin publish path is
# non-fatal anyway; this just keeps the test suite fast and deterministic.
from unittest.mock import AsyncMock
agent_service.twin_publisher.publish_agent_event = AsyncMock(return_value=True)
agent_service.twin_publisher.publish_state_change = AsyncMock(return_value=True)

client = TestClient(app)
HEADERS = {"X-API-KEY": "MOCK_API_KEY_123"}

TEST_PASSENGER_ID = 1
TEST_BAG_ID = 1


@pytest.fixture(autouse=True)
def clean_tables():
    """Clean all agent-related tables before each test."""
    db = SessionLocal()
    try:
        # Delete in dependency order
        for tbl in ["decisionaudit", "agenteexecution", "agenttask", "airportevent", "workflowexecution", "agentdefinition"]:
            db.execute(text(f"DELETE FROM {tbl}"))
        db.commit()
    finally:
        db.close()
    yield


@pytest.fixture
def temp_image(tmp_path):
    """Create a small valid PNG image file for BTD inference tests (no PIL needed)."""
    # Minimal valid 1x1 opaque PNG.
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
        b"\x90wS\xde"
        b"\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x18\xd8\xff\xff"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    img_path = tmp_path / "xray.png"
    img_path.write_bytes(png_bytes)
    return str(img_path)
