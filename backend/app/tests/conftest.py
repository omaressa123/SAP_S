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
    smoke_fire_url="http://localhost:8003",
    fall_detection_url="http://localhost:8004",
    twin_base_url="http://localhost:8100",
)

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
