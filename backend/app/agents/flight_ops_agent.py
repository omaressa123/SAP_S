"""Flight Operations Agent — manages flight status, gate assignments, and delay propagation.

Responsibilities:
  - Coordinate real-time flight state machine transitions (SCHEDULED -> BOARDING -> DEPARTED -> ARRIVED)
  - Perform intelligent boarding gate assignment and conflict resolution
  - Propagate delay impacts to downstream flights and passengers
  - Support disruption rebooking workflows
  - Sync with Digital Twin and FIDS boards
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone, timedelta

from ..database import SessionLocal
from ..models.flights import Flight, Booking
from ..models.security import BoardingGate
from .base import AgentInterface, AgentCapability, AgentResult


class FlightOpsAgent(AgentInterface):
    """Agent for flight operations, gate management, and delay handling."""

    def __init__(self):
        super().__init__(
            agent_id="flight_ops_agent",
            name="Flight Operations Agent",
            description="Coordinates flight schedules, gate allocations, and delay propagation.",
        )
        self.register_capability(AgentCapability(
            name="update_flight_status",
            description="Update the operational status of a scheduled or active flight",
            input_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "new_status": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["flight_id", "new_status"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "previous_status": {"type": "string"},
                    "current_status": {"type": "string"},
                    "updated_at": {"type": "string"},
                },
            },
            requires_human_review=False,
            timeout_seconds=30,
        ))

        self.register_capability(AgentCapability(
            name="assign_gate",
            description="Allocate or reassign an airport boarding gate to an active flight",
            input_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "gate_id": {"type": "integer"},
                    "preferred_gate_code": {"type": "string"},
                },
                "required": ["flight_id"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "assigned_gate_id": {"type": "integer"},
                    "gate_number": {"type": "string"},
                    "status": {"type": "string"},
                },
            },
            requires_human_review=False,
            timeout_seconds=30,
        ))

        self.register_capability(AgentCapability(
            name="propagate_delay",
            description="Calculate and apply flight delays with passenger impact estimates",
            input_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "delay_minutes": {"type": "integer"},
                    "reason": {"type": "string"},
                },
                "required": ["flight_id", "delay_minutes"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "flight_id": {"type": "integer"},
                    "delay_minutes": {"type": "integer"},
                    "new_departure": {"type": "string"},
                    "affected_passengers": {"type": "integer"},
                },
            },
            requires_human_review=False,
            timeout_seconds=45,
        ))

        # Register event handlers
        self.register_handler("flight_delay", self._handle_delay_event)
        self.register_handler("gate_change", self._handle_gate_change_event)
        self.register_handler("aircraft_arrival", self._handle_status_transition)
        self.register_handler("aircraft_departure", self._handle_status_transition)
        self.register_handler("turnaround_milestone", self._handle_status_transition)

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "flight_id" in payload or "flight_number" in payload

    async def handle_event(self, event) -> AgentResult:
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    async def _handle_delay_event(self, payload: Dict[str, Any]) -> AgentResult:
        flight_id = payload.get("flight_id")
        delay_minutes = int(payload.get("delay_minutes", 0))
        reason = payload.get("reason", "Operational adjustment")

        db = SessionLocal()
        try:
            flight = db.query(Flight).filter(Flight.flight_id == flight_id).first()
            if not flight:
                return AgentResult(success=False, error=f"Flight {flight_id} not found")

            orig_dep = flight.scheduled_departure or datetime.now(timezone.utc)
            new_dep = orig_dep + timedelta(minutes=delay_minutes)
            flight.scheduled_departure = new_dep
            flight.status = "DELAYED"
            db.commit()

            # Count affected passengers
            pax_count = db.query(Booking).filter(Booking.flight_id == flight_id).count()

            requires_review = delay_minutes >= 120
            return AgentResult(
                success=True,
                data={
                    "flight_id": flight_id,
                    "flight_number": flight.flight_number,
                    "delay_minutes": delay_minutes,
                    "new_departure": new_dep.isoformat(),
                    "affected_passengers": pax_count,
                    "reason": reason,
                    "status": "DELAYED",
                },
                requires_human_review=requires_review,
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

    async def _handle_gate_change_event(self, payload: Dict[str, Any]) -> AgentResult:
        flight_id = payload.get("flight_id")
        preferred_code = payload.get("preferred_gate_code")
        gate_id = payload.get("gate_id")

        db = SessionLocal()
        try:
            flight = db.query(Flight).filter(Flight.flight_id == flight_id).first()
            if not flight:
                return AgentResult(success=False, error=f"Flight {flight_id} not found")

            assigned_gate = None
            if gate_id:
                assigned_gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == gate_id).first()
            elif preferred_code:
                assigned_gate = db.query(BoardingGate).filter(BoardingGate.gate_number == preferred_code).first()

            if not assigned_gate:
                # Find any open gate
                assigned_gate = db.query(BoardingGate).filter(BoardingGate.status == "OPEN").first()

            if not assigned_gate:
                return AgentResult(
                    success=False,
                    error="No available boarding gate found",
                    requires_human_review=True,
                )

            flight.boarding_gate_id = assigned_gate.boarding_gate_id
            db.commit()

            return AgentResult(
                success=True,
                data={
                    "flight_id": flight_id,
                    "flight_number": flight.flight_number,
                    "assigned_gate_id": assigned_gate.boarding_gate_id,
                    "gate_number": assigned_gate.gate_number,
                    "status": "GATE_ASSIGNED",
                },
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

    async def _handle_status_transition(self, payload: Dict[str, Any]) -> AgentResult:
        flight_id = payload.get("flight_id")
        new_status = payload.get("new_status") or payload.get("status", "ACTIVE")

        db = SessionLocal()
        try:
            flight = db.query(Flight).filter(Flight.flight_id == flight_id).first()
            if not flight:
                return AgentResult(success=False, error=f"Flight {flight_id} not found")

            prev_status = flight.status
            flight.status = new_status
            db.commit()

            return AgentResult(
                success=True,
                data={
                    "flight_id": flight_id,
                    "flight_number": flight.flight_number,
                    "previous_status": prev_status,
                    "current_status": new_status,
                },
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

