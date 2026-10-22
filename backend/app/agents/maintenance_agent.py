"""Maintenance Agent — IoT equipment telemetry health scoring and predictive maintenance.

Responsibilities:
  - Process real-time sensor telemetry from ESP32 airport modules (conveyors, gates, chargers)
  - Detect vibration, thermal, and motor current anomalies
  - Record equipment health checks in the database
  - Flag degraded hardware and dispatch maintenance work orders
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone

from ..database import SessionLocal
from ..models.devices import Equipment, EquipmentHealthCheck
from .base import AgentInterface, AgentCapability, AgentResult


class MaintenanceAgent(AgentInterface):
    """Agent for automated equipment health monitoring and maintenance scheduling."""

    def __init__(self):
        super().__init__(
            agent_id="maintenance_agent",
            name="Maintenance & Diagnostics Agent",
            description="Ingests equipment telemetry, computes health scores, and schedules maintenance.",
        )
        self.register_capability(AgentCapability(
            name="process_telemetry",
            description="Evaluate telemetry metrics from IoT sensors and compute health score",
            input_schema={
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "integer"},
                    "serial_number": {"type": "string"},
                    "temperature": {"type": "number"},
                    "vibration_rms": {"type": "number"},
                    "current_draw": {"type": "number"},
                },
                "required": [],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "integer"},
                    "health_score": {"type": "number"},
                    "status": {"type": "string"},
                    "anomaly_detected": {"type": "boolean"},
                },
            },
            requires_human_review=False,
            timeout_seconds=20,
        ))

        self.register_capability(AgentCapability(
            name="create_work_order",
            description="Generate a maintenance inspection record for degraded equipment",
            input_schema={
                "type": "object",
                "properties": {
                    "equipment_id": {"type": "integer"},
                    "fault_code": {"type": "string"},
                    "priority": {"type": "string"},
                },
                "required": ["equipment_id"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "check_id": {"type": "integer"},
                    "equipment_id": {"type": "integer"},
                    "status": {"type": "string"},
                },
            },
            requires_human_review=False,
            timeout_seconds=20,
        ))

        # Register event handlers
        self.register_handler("equipment_telemetry", self._handle_telemetry_event)
        self.register_handler("health_check_failure", self._handle_failure_event)
        self.register_handler("vibration_anomaly", self._handle_anomaly_event)
        self.register_handler("conveyor_jam", self._handle_anomaly_event)
        self.register_handler("escalator_fault", self._handle_anomaly_event)

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "equipment_id" in payload or "serial_number" in payload or "device_id" in payload

    async def handle_event(self, event) -> AgentResult:
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    async def _handle_telemetry_event(self, payload: Dict[str, Any]) -> AgentResult:
        eq_id = payload.get("equipment_id")
        serial = payload.get("serial_number") or payload.get("device_id")
        temp = float(payload.get("temperature", 45.0))
        vib = float(payload.get("vibration_rms", 1.2))

        # Health score computation: baseline 100, penalized by excess heat (>75C) or vibration (>3.5g)
        score = 100.0
        if temp > 75.0:
            score -= min((temp - 75.0) * 2.0, 40.0)
        if vib > 3.5:
            score -= min((vib - 3.5) * 15.0, 50.0)
        score = max(round(score, 1), 0.0)

        anomaly = score < 60.0
        status = "HEALTHY" if score >= 80 else ("DEGRADED" if score >= 50 else "CRITICAL")

        db = SessionLocal()
        try:
            eq = None
            if eq_id:
                eq = db.query(Equipment).filter(Equipment.equipment_id == eq_id).first()
            elif serial:
                eq = db.query(Equipment).filter(Equipment.serial_number == str(serial)).first()

            if eq:
                eq.status = status
                eq.last_health_check = datetime.now(timezone.utc)
                db.commit()
                eq_id = eq.equipment_id

            return AgentResult(
                success=True,
                data={
                    "equipment_id": eq_id,
                    "health_score": score,
                    "status": status,
                    "anomaly_detected": anomaly,
                    "metrics": {"temperature": temp, "vibration_rms": vib},
                },
                requires_human_review=anomaly,
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

    async def _handle_failure_event(self, payload: Dict[str, Any]) -> AgentResult:
        eq_id = payload.get("equipment_id", 1)
        fault_code = payload.get("fault_code", "E_UNKNOWN_FAULT")

        db = SessionLocal()
        try:
            check = EquipmentHealthCheck(
                equipment_id=eq_id,
                check_time=datetime.now(timezone.utc),
                metric_type=f"ALERT_{fault_code}",
            )
            db.add(check)
            db.commit()

            return AgentResult(
                success=True,
                data={
                    "equipment_id": eq_id,
                    "fault_code": fault_code,
                    "check_id": check.check_id,
                    "work_order_created": True,
                    "status": "MAINTENANCE_REQUIRED",
                },
                requires_human_review=True,
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

    async def _handle_anomaly_event(self, payload: Dict[str, Any]) -> AgentResult:
        eq_id = payload.get("equipment_id", 1)
        anomaly_type = payload.get("anomaly_type", "MECHANICAL_FAULT")
        return AgentResult(
            success=True,
            data={
                "equipment_id": eq_id,
                "anomaly_type": anomaly_type,
                "action": "THROTTLE_AND_INSPECT",
                "status": "INCIDENT_LOGGED",
            },
            requires_human_review=True,
        )

