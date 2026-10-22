"""Tests for Phase 2 Autonomous Domain Agents:
- FlightOpsAgent
- MaintenanceAgent
- NotificationAgent
- SustainabilityAgent
"""
import asyncio
import pytest
from datetime import datetime, timezone
from app.database import SessionLocal
from app.models.flights import Flight
from app.agents.flight_ops_agent import FlightOpsAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.notification_agent import NotificationAgent
from app.agents.sustainability_agent import SustainabilityAgent
from app.agents.events import AirportEvent
from app.agents.service import agent_service


@pytest.fixture
def service():
    if not agent_service.initialized:
        agent_service.init()
    return agent_service


@pytest.fixture
def test_flight_id():
    db = SessionLocal()
    flight = db.query(Flight).first()
    if not flight:
        flight = Flight(
            flight_number="QR-082",
            status="SCHEDULED",
            scheduled_departure=datetime.now(timezone.utc),
        )
        db.add(flight)
        db.commit()
        db.refresh(flight)
    f_id = flight.flight_id
    db.close()
    return f_id


def test_flight_ops_agent_capabilities(test_flight_id):
    agent = FlightOpsAgent()
    assert agent.agent_id == "flight_ops_agent"
    assert agent.has_capability("update_flight_status")
    assert agent.has_capability("assign_gate")
    assert agent.has_capability("propagate_delay")

    # Test delay handling
    event = AirportEvent(
        event_id="evt-flight-1",
        event_type="flight_delay",
        source="api",
        payload={"flight_id": test_flight_id, "delay_minutes": 45, "reason": "Weather holding"},
    )
    result = asyncio.run(agent.handle_event(event))
    assert result.success is True
    assert result.data["delay_minutes"] == 45
    assert result.data["status"] == "DELAYED"


def test_maintenance_agent_telemetry():
    agent = MaintenanceAgent()
    assert agent.agent_id == "maintenance_agent"
    assert agent.has_capability("process_telemetry")
    assert agent.has_capability("create_work_order")

    # Healthy telemetry
    event = AirportEvent(
        event_id="evt-maint-1",
        event_type="equipment_telemetry",
        source="iot_device",
        payload={"equipment_id": 1, "temperature": 50.0, "vibration_rms": 1.2},
    )
    result = asyncio.run(agent.handle_event(event))
    assert result.success is True
    assert result.data["health_score"] >= 80.0
    assert result.data["status"] == "HEALTHY"
    assert result.data["anomaly_detected"] is False

    # Degraded/overheating telemetry
    degraded_event = AirportEvent(
        event_id="evt-maint-2",
        event_type="equipment_telemetry",
        source="iot_device",
        payload={"equipment_id": 1, "temperature": 92.0, "vibration_rms": 4.8},
    )
    deg_result = asyncio.run(agent.handle_event(degraded_event))
    assert deg_result.success is True
    assert deg_result.data["health_score"] < 60.0
    assert deg_result.data["anomaly_detected"] is True
    assert deg_result.requires_human_review is True


def test_notification_agent_boarding_call(test_flight_id):
    agent = NotificationAgent()
    assert agent.agent_id == "notification_agent"
    assert agent.has_capability("send_push_notification")
    assert agent.has_capability("broadcast_gate_call")

    event = AirportEvent(
        event_id="evt-notif-1",
        event_type="boarding_call",
        source="flight_ops_agent",
        payload={"flight_id": test_flight_id, "gate": "B22", "content": "Flight QR-082 is now boarding at Gate B22."},
    )
    result = asyncio.run(agent.handle_event(event))
    assert result.success is True
    assert result.data["status"] == "DELIVERED"
    assert "B22" in result.data["content"]


def test_sustainability_agent_optimization():
    agent = SustainabilityAgent()
    assert agent.agent_id == "sustainability_agent"
    assert agent.has_capability("optimize_energy")
    assert agent.has_capability("calculate_footprint")

    # Low occupancy optimization
    event = AirportEvent(
        event_id="evt-sust-1",
        event_type="occupancy_update",
        source="iot_device",
        payload={"zone_id": 1, "occupancy": 35},
    )
    result = asyncio.run(agent.handle_event(event))
    assert result.success is True
    assert result.data["hvac_setpoint_c"] == 24.0
    assert result.data["lighting_level_pct"] == 50
    assert result.data["estimated_power_saving_kw"] > 0

    # Solar yield calculation
    solar_event = AirportEvent(
        event_id="evt-sust-2",
        event_type="solar_peak_yield",
        source="iot_device",
        payload={"solar_kwh": 250.0},
    )
    solar_result = asyncio.run(agent.handle_event(solar_event))
    assert solar_result.success is True
    assert solar_result.data["co2_avoided_kg"] == 105.0


def test_registry_contains_all_phase1_and_phase2_agents(service):
    registry = service.get_registry()
    agents = registry.list_agents()
    agent_ids = [a.agent_id for a in agents]

    # Phase 1
    assert "identity_agent" in agent_ids
    assert "baggage_agent" in agent_ids
    assert "safety_agent" in agent_ids

    # Phase 2
    assert "flight_ops_agent" in agent_ids
    assert "maintenance_agent" in agent_ids
    assert "notification_agent" in agent_ids
    assert "sustainability_agent" in agent_ids

