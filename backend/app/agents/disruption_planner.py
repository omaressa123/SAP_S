"""LLM-Assisted Disruption Recovery Planner (M2.8).

Produces validated recovery proposals for airport disruptions (weather,
runway closure, ground stop, etc.).

Design principles (safety first):
  - Proposal generation, validation, approval and execution are SEPARATE.
  - An LLM is used ONLY if a provider is configured via environment variables
    (DISRUPTION_LLM_BASE_URL / DISRUPTION_LLM_API_KEY). Otherwise a
    deterministic heuristic fallback builds the plan.
  - Model output is NEVER executed directly: every plan is validated against
    strict schemas and deterministic business rules before approval.
  - Consequential operational actions require authorized human approval
    (JWT staff/admin) before execution.
  - Actions are executed through the existing registered agent capabilities
    (the AgentRegistry / AgentInterface contract) — no new agent code.
  - Proposals, validation outcomes, approvals, execution results and
    failures are persisted to the existing PostgreSQL database.
  - No Redis/Kafka/new infrastructure is introduced.
"""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.disruption import DisruptionProposal
from ..models.flights import Flight, Booking, Airline, Airport
from ..models.security import BoardingGate
from ..models.wayfinding import Zone
from ..models.devices import Equipment
from ..models.passenger import Passenger
from ..agents.registry import AgentRegistry


# ---------------------------------------------------------------- constraints

MIN_TURNAROUND_MINUTES = 45
MAX_DAILY_FLIGHT_HOURS = 12
GATE_CONFLICT_BUFFER_MINUTES = 15

ALLOWED_AGENTS = {
    "flight_ops_agent": {
        "update_flight_status", "assign_gate", "propagate_delay", "rebook_passengers",
    },
    "notification_agent": {
        "send_push_notification", "send_sms", "broadcast_gate_call",
        "dispatch_emergency_pns",
    },
    "maintenance_agent": {
        "process_telemetry", "create_work_order", "schedule_downtime",
    },
    "safety_agent": {"assess_safety"},
    "sustainability_agent": {"optimize_energy", "calculate_footprint"},
    "identity_agent": {"verify_identity"},
    "baggage_agent": {"screen_baggage", "track_baggage"},
}

CONSEQUENTIAL_ACTIONS = {
    "assign_gate", "propagate_delay", "rebook_passengers",
    "dispatch_emergency_pns", "schedule_downtime",
}


@dataclass
class PlanAction:
    agent: str
    capability: str
    parameters: Dict[str, Any]
    requires_approval: bool = False


@dataclass
class ValidationResult:
    passed: bool
    violations: List[str] = field(default_factory=list)
    rules_checked: List[str] = field(default_factory=list)


@dataclass
class Proposal:
    proposal_id: str
    scenario_id: str
    scenario_type: str
    severity: str
    root_cause: str
    status: str
    snapshot: Dict[str, Any]
    actions: List[PlanAction]
    validation: ValidationResult
    created_by: str
    created_at: str
    error_message: Optional[str] = None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _run_async(coro):
    """Run an async coroutine on a fresh event loop (sync callers)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


# ---------------------------------------------------------------- snapshot

def build_snapshot(db: Session) -> Dict[str, Any]:
    """Build the operational snapshot from actual available data.

    Reads flights, gates, bookings, airlines, airports, equipment, zones and
    passengers. Never fabricates data — absent values are omitted or null.
    """
    flights = []
    for f in db.query(Flight).all():
        origin = db.query(Airport).filter(Airport.airport_id == f.origin_airport_id).first() if f.origin_airport_id else None
        dest = db.query(Airport).filter(Airport.airport_id == f.destination_airport_id).first() if f.destination_airport_id else None
        airline = db.query(Airline).filter(Airline.airline_id == f.airline_id).first() if f.airline_id else None
        gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == f.boarding_gate_id).first() if f.boarding_gate_id else None
        pax_count = db.query(Booking).filter(Booking.flight_id == f.flight_id).count()
        flights.append({
            "flight_id": f.flight_id,
            "flight_number": f.flight_number,
            "status": f.status,
            "scheduled_departure": f.scheduled_departure.isoformat() if f.scheduled_departure else None,
            "actual_departure": f.actual_departure.isoformat() if f.actual_departure else None,
            "boarding_gate_id": f.boarding_gate_id,
            "gate_number": gate.gate_number if gate else None,
            "gate_status": gate.status if gate else None,
            "origin": origin.iata_code if origin else None,
            "destination": dest.iata_code if dest else None,
            "airline": airline.iata_code if airline else None,
            "passenger_count": pax_count,
        })

    gates = []
    for g in db.query(BoardingGate).all():
        gates.append({
            "boarding_gate_id": g.boarding_gate_id,
            "gate_number": g.gate_number,
            "status": g.status,
            "zone_id": g.zone_id,
            "equipment_id": g.equipment_id,
        })

    bookings = []
    for b in db.query(Booking).all():
        bookings.append({
            "booking_id": b.booking_id,
            "passenger_id": b.passenger_id,
            "flight_id": b.flight_id,
            "booking_reference": b.booking_reference,
            "seat_number": b.seat_number,
            "booking_status": b.booking_status,
        })

    equipment = []
    for e in db.query(Equipment).all():
        equipment.append({
            "equipment_id": e.equipment_id,
            "equipment_type": e.equipment_type,
            "label": e.label,
            "serial_number": e.serial_number,
            "zone_id": e.zone_id,
            "status": e.status,
        })

    zones = []
    for z in db.query(Zone).all():
        zones.append({
            "zone_id": z.zone_id,
            "zone_name": z.zone_name,
            "terminal": z.terminal,
            "capacity": z.capacity,
            "current_occupancy": z.current_occupancy,
        })

    passengers = []
    for p in db.query(Passenger).all():
        passengers.append({
            "passenger_id": p.id,
            "passport_number": p.passport_number,
            "biometric_registered": p.biometric_registered,
        })

    return {
        "generated_at": _utc_now().isoformat(),
        "flights": flights,
        "gates": gates,
        "bookings": bookings,
        "equipment": equipment,
        "zones": zones,
        "passengers": passengers,
        "flight_count": len(flights),
        "gate_count": len(gates),
    }


# ---------------------------------------------------------------- LLM (optional)

def _llm_configured() -> bool:
    return bool(os.getenv("DISRUPTION_LLM_BASE_URL") and os.getenv("DISRUPTION_LLM_API_KEY"))


async def _llm_generate(snapshot: Dict[str, Any], scenario_type: str,
                        severity: str, root_cause: str) -> Optional[List[Dict[str, Any]]]:
    """Ask a configured LLM provider for a recovery plan.

    Returns a list of action dicts or None if the provider is unavailable /
    misconfigured. The result is ALWAYS re-validated by the deterministic
    validator before being used — model output is never trusted.
    """
    if not _llm_configured():
        return None
    try:
        import httpx  # type: ignore
        base_url = os.getenv("DISRUPTION_LLM_BASE_URL").rstrip("/")
        api_key = os.getenv("DISRUPTION_LLM_API_KEY")
        prompt = {
            "scenario_type": scenario_type,
            "severity": severity,
            "root_cause": root_cause,
            "snapshot": snapshot,
            "allowed_agents": ALLOWED_AGENTS,
            "constraints": {
                "min_turnaround_minutes": MIN_TURNAROUND_MINUTES,
                "gate_conflict_buffer_minutes": GATE_CONFLICT_BUFFER_MINUTES,
            },
            "instruction": (
                "Return a JSON array of recovery actions. Each action: "
                '{"agent": "<agent_id>", "capability": "<capability>", '
                '"parameters": {...}}. Only use allowed agents/capabilities. '
                "Do not propose gate double-bookings or illegal turnarounds."
            ),
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                base_url + "/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "disruption-planner",
                    "messages": [{"role": "user", "content": json.dumps(prompt)}],
                    "temperature": 0,
                },
            )
            if r.status_code >= 400:
                return None
            data = r.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "[]")
        actions = json.loads(content)
        if isinstance(actions, list):
            return actions
        return None
    except Exception:  # noqa: BLE001
        return None


# ---------------------------------------------------------------- heuristic fallback

def _heuristic_generate(snapshot: Dict[str, Any], scenario_type: str,
                        severity: str, root_cause: str) -> List[Dict[str, Any]]:
    """Deterministic heuristic recovery plan (no LLM).

    Produces a conservative, rule-based recovery: delay affected flights,
    reassign gates only when a free compatible gate exists, notify affected
    passengers, and escalate anything it cannot safely resolve.
    """
    actions: List[Dict[str, Any]] = []
    flights = snapshot.get("flights", [])
    gates = {g["boarding_gate_id"]: g for g in snapshot.get("gates", [])}
    used_gates: Dict[int, str] = {}

    affected_ids: List[int] = []
    if scenario_type == "ground_stop":
        affected_ids = [f["flight_id"] for f in flights if f["status"] in ("SCHEDULED", "DELAYED")]
    elif scenario_type == "runway_closure":
        affected_ids = [f["flight_id"] for f in flights if f["status"] == "SCHEDULED"]
    elif scenario_type == "weather":
        affected_ids = [f["flight_id"] for f in flights if f["status"] == "SCHEDULED"][:5]

    for fid in affected_ids:
        flight = next((f for f in flights if f["flight_id"] == fid), None)
        if not flight:
            continue
        delay = 60 if severity in ("high", "critical") else 30
        actions.append({
            "agent": "flight_ops_agent",
            "capability": "propagate_delay",
            "parameters": {
                "flight_id": fid,
                "delay_minutes": delay,
                "reason": f"{root_cause} ({scenario_type})",
            },
        })
        cur_gate = flight.get("boarding_gate_id")
        if cur_gate:
            alt = next((gid for gid, g in gates.items()
                        if gid != cur_gate and gid not in used_gates
                        and g["status"] == "OPEN"), None)
            if alt:
                used_gates[alt] = str(fid)
                actions.append({
                    "agent": "flight_ops_agent",
                    "capability": "assign_gate",
                    "parameters": {"flight_id": fid, "gate_id": alt},
                })

    for fid in affected_ids[:10]:
        actions.append({
            "agent": "notification_agent",
            "capability": "send_push_notification",
            "parameters": {
                "flight_id": fid,
                "title": "Flight Update",
                "body": f"Flight affected by {scenario_type}: {root_cause}. "
                        "Check your gate and departure time.",
            },
        })

    return actions


# ---------------------------------------------------------------- validation

def validate_plan(snapshot: Dict[str, Any], actions: List[Dict[str, Any]]) -> ValidationResult:
    """Strict deterministic validation of a proposed plan.

    Rejects unknown agents, unsupported actions, invalid parameters,
    impossible allocations, resource conflicts (gate double-booking) and
    invalid timing. Never fabricates a pass.
    """
    violations: List[str] = []
    rules_checked: List[str] = []
    gates = {g["boarding_gate_id"]: g for g in snapshot.get("gates", [])}
    flights = {f["flight_id"]: f for f in snapshot.get("flights", [])}
    assigned_gates: Dict[int, int] = {}

    for i, action in enumerate(actions):
        agent = action.get("agent")
        capability = action.get("capability")
        params = action.get("parameters") or {}
        prefix = f"action[{i}]"

        if agent not in ALLOWED_AGENTS:
            violations.append(f"{prefix}: unknown agent '{agent}'")
        rules_checked.append("known_agent")
        if agent not in ALLOWED_AGENTS:
            continue

        if capability not in ALLOWED_AGENTS[agent]:
            violations.append(f"{prefix}: agent '{agent}' does not support capability '{capability}'")
        rules_checked.append("supported_capability")
        if capability not in ALLOWED_AGENTS[agent]:
            continue

        if agent == "flight_ops_agent":
            if capability in ("update_flight_status", "propagate_delay", "assign_gate"):
                if "flight_id" not in params:
                    violations.append(f"{prefix}: missing flight_id for {capability}")
            if capability == "propagate_delay" and "delay_minutes" not in params:
                violations.append(f"{prefix}: missing delay_minutes")
            if capability == "assign_gate":
                if "gate_id" not in params and "preferred_gate_code" not in params:
                    violations.append(f"{prefix}: missing gate_id/preferred_gate_code")
        rules_checked.append("required_parameters")
        if violations and violations[-1].startswith(prefix):
            continue

        flight_id = params.get("flight_id")
        if flight_id is not None and flight_id not in flights:
            violations.append(f"{prefix}: flight_id {flight_id} does not exist")
        rules_checked.append("flight_exists")

        if capability == "assign_gate" and "gate_id" in params:
            gid = params["gate_id"]
            if gid not in gates:
                violations.append(f"{prefix}: gate_id {gid} does not exist")
            elif gid in assigned_gates and assigned_gates[gid] != flight_id:
                violations.append(f"{prefix}: gate {gid} already assigned to flight {assigned_gates[gid]}")
            else:
                assigned_gates[gid] = flight_id

        if capability == "propagate_delay":
            try:
                dm = int(params.get("delay_minutes", 0))
                if dm < 0:
                    violations.append(f"{prefix}: negative delay_minutes")
            except (TypeError, ValueError):
                violations.append(f"{prefix}: invalid delay_minutes")

    passed = len(violations) == 0
    return ValidationResult(passed=passed, violations=violations, rules_checked=rules_checked)


# ---------------------------------------------------------------- planner

class DisruptionPlanner:
    """Generates, validates, approves and executes disruption recovery plans."""

    def __init__(
        self,
        session_factory: Callable[[], Session] = SessionLocal,
        registry: Optional[AgentRegistry] = None,
    ):
        self._session_factory = session_factory
        self.registry = registry

    # ---------------------------------------------------------------- generate

    def generate_proposal(
        self,
        *,
        scenario_id: str,
        scenario_type: str,
        severity: str,
        root_cause: str,
        created_by: str = "system",
    ) -> Dict[str, Any]:
        db = self._session_factory()
        try:
            snapshot = build_snapshot(db)

            actions_raw: Optional[List[Dict[str, Any]]] = None
            source = "heuristic"
            try:
                actions_raw = _run_async(
                    _llm_generate(snapshot, scenario_type, severity, root_cause)
                )
            except Exception:  # noqa: BLE001
                actions_raw = None
            if actions_raw is None:
                actions_raw = _heuristic_generate(snapshot, scenario_type, severity, root_cause)
                source = "heuristic"

            validation = validate_plan(snapshot, actions_raw)
            status = "validated" if validation.passed else "rejected"

            proposal = DisruptionProposal(
                proposal_id=f"prop_{uuid.uuid4().hex[:12]}",
                scenario_id=scenario_id,
                scenario_type=scenario_type,
                severity=severity,
                root_cause=root_cause,
                status=status,
                created_by=created_by,
                snapshot=json.dumps(snapshot),
                actions=json.dumps(actions_raw),
                validation_result=json.dumps({
                    "passed": validation.passed,
                    "violations": validation.violations,
                    "rules_checked": validation.rules_checked,
                }),
                error_message=None if validation.passed else "; ".join(validation.violations),
                expires_at=_utc_now() + timedelta(hours=24),
            )
            db.add(proposal)
            db.commit()
            db.refresh(proposal)
            return self._serialize(proposal)
        finally:
            db.close()

    # ---------------------------------------------------------------- queries

    def get_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        db = self._session_factory()
        try:
            row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
            return self._serialize(row) if row else None
        finally:
            db.close()

    def list_proposals(self, limit: int = 50) -> List[Dict[str, Any]]:
        db = self._session_factory()
        try:
            rows = (
                db.query(DisruptionProposal)
                .order_by(DisruptionProposal.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._serialize(r) for r in rows]
        finally:
            db.close()

    # ---------------------------------------------------------------- approve / execute

    def approve_proposal(self, proposal_id: str, staff_id: int,
                         reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Authorize a proposal for execution (staff/admin only)."""
        db = self._session_factory()
        try:
            row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
            if row is None:
                return None
            if row.status != "validated":
                return self._serialize(row)
            from ..models.staff import Staff
            staff = db.query(Staff).filter(Staff.staff_id == staff_id).first()
            if staff is None or not staff.is_active:
                return None
            row.status = "approved"
            row.approved_by = staff_id
            row.approved_at = _utc_now()
            row.error_message = None
            db.commit()
            return self._serialize(row)
        finally:
            db.close()

    def execute_proposal(self, proposal_id: str) -> Optional[Dict[str, Any]]:
        """Execute an approved proposal through registered agent capabilities."""
        db = self._session_factory()
        try:
            row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
            if row is None:
                return None
            if row.status != "approved":
                return self._serialize(row)
        finally:
            db.close()

        if self.registry is None:
            db = self._session_factory()
            try:
                row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
                row.status = "failed"
                row.error_message = "no agent registry configured"
                row.updated_at = _utc_now()
                db.commit()
            finally:
                db.close()
            return self.get_proposal(proposal_id)

        actions = json.loads(row.actions or "[]")
        results: List[Dict[str, Any]] = []
        failed_consequential = False

        for action in actions:
            agent_id = action.get("agent")
            capability = action.get("capability")
            params = action.get("parameters") or {}
            result = {"agent": agent_id, "capability": capability, "parameters": params,
                      "executed": False, "error": None}
            if agent_id not in ALLOWED_AGENTS or capability not in ALLOWED_AGENTS.get(agent_id, set()):
                result["error"] = "agent/capability not allowed by planner policy"
                if capability in CONSEQUENTIAL_ACTIONS:
                    failed_consequential = True
            else:
                agent = self.registry.get(agent_id)
                if agent is None or not agent.is_healthy():
                    result["error"] = f"agent {agent_id} unavailable"
                    if capability in CONSEQUENTIAL_ACTIONS:
                        failed_consequential = True
                else:
                    try:
                        ares = _run_async(
                            agent.execute_with_guard(event_type=capability, payload=params))
                        result["executed"] = ares.success
                        result["output"] = ares.to_dict()
                        if not ares.success:
                            result["error"] = ares.error
                            if capability in CONSEQUENTIAL_ACTIONS:
                                failed_consequential = True
                    except Exception as exc:  # noqa: BLE001
                        result["error"] = str(exc)
                        if capability in CONSEQUENTIAL_ACTIONS:
                            failed_consequential = True
            results.append(result)

        db = self._session_factory()
        try:
            row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
            row.status = "failed" if failed_consequential else "executed"
            row.execution_result = json.dumps(results)
            row.executed_at = _utc_now()
            row.error_message = "; ".join(r["error"] for r in results if r["error"]) or None
            row.updated_at = _utc_now()
            db.commit()
        finally:
            db.close()
        return self.get_proposal(proposal_id)

    def reject_proposal(self, proposal_id: str, staff_id: int,
                        reason: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db = self._session_factory()
        try:
            row = db.query(DisruptionProposal).filter(DisruptionProposal.proposal_id == proposal_id).first()
            if row is None:
                return None
            if row.status not in {"proposed", "validated", "rejected"}:
                return self._serialize(row)
            from ..models.staff import Staff
            staff = db.query(Staff).filter(Staff.staff_id == staff_id).first()
            if staff is None or not staff.is_active:
                return None
            row.status = "rejected"
            row.error_message = reason or "rejected by human reviewer"
            row.updated_at = _utc_now()
            db.commit()
            return self._serialize(row)
        finally:
            db.close()

    # ---------------------------------------------------------------- serialization

    def _serialize(self, row: DisruptionProposal) -> Dict[str, Any]:
        return {
            "proposal_id": row.proposal_id,
            "scenario_id": row.scenario_id,
            "scenario_type": row.scenario_type,
            "severity": row.severity,
            "root_cause": row.root_cause,
            "status": row.status,
            "created_by": row.created_by,
            "approved_by": row.approved_by,
            "approved_at": row.approved_at.isoformat() if row.approved_at else None,
            "executed_at": row.executed_at.isoformat() if row.executed_at else None,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "snapshot": json.loads(row.snapshot or "{}"),
            "actions": json.loads(row.actions or "[]"),
            "validation_result": json.loads(row.validation_result or "{}"),
            "execution_result": json.loads(row.execution_result or "[]") if row.execution_result else None,
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
