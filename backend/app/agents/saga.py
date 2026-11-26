"""Persistent Passenger Journey Saga engine.

Durable, resumable multi-step workflow that executes the passenger journey
steps in domain order (identity -> baggage -> security -> boarding) with
compensating rollbacks, retry tracking, and idempotent resumption.

Implementation notes:
  - State is persisted to PostgreSQL (sagainstance, sagastep, sagacompensation).
  - A Saga is NOT a single atomic transaction: each step commits independently
    and compensations reflect real (best-effort) domain behavior.
  - Steps are executed through the existing AgentRegistry / AgentInterface
    contract (execute_with_guard), so existing agents are reused unchanged.
  - Step events and step outcomes are published to the existing EventSystem and
    Digital Twin (TwinPublisher) for observability. Each step result is also
    recorded in DecisionAudit (existing audit table).
  - Idempotent: starting a journey with an existing correlation_id returns the
    persisted instance without re-executing completed steps.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session, sessionmaker

from ..database import SessionLocal, engine as _db_engine

# Saga-internal sessions use expire_on_commit=False so persisted instances
# remain usable after commit/close without triggering DetachedInstanceError
# on attribute access (the engine returns these objects to callers).
_SagaSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=_db_engine, expire_on_commit=False
)
from ..models.saga import SagaInstance, SagaStep, SagaCompensation
from ..models.agents import DecisionAudit as MDecisionAudit
from .base import AgentInterface, AgentResult
from .registry import AgentRegistry
from .events import EventSystem, AirportEvent, EventSource, EventSeverity


class SagaStatus(str):
    INITIATED = "initiated"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    COMPENSATED = "compensated"
    HUMAN_REVIEW_REQUIRED = "human_review_required"


class StepStatus(str):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    NEEDS_REVIEW = "needs_review"
    COMPENSATED = "compensated"


ALL_STATUSES = {
    SagaStatus.INITIATED, SagaStatus.RUNNING, SagaStatus.COMPLETED,
    SagaStatus.FAILED, SagaStatus.CANCELLED, SagaStatus.COMPENSATED,
    SagaStatus.HUMAN_REVIEW_REQUIRED,
}

# Legal transitions: from -> set of allowed to
LEGAL_TRANSITIONS: Dict[str, set] = {
    SagaStatus.INITIATED: {SagaStatus.RUNNING, SagaStatus.CANCELLED},
    SagaStatus.RUNNING: {
        SagaStatus.COMPLETED, SagaStatus.FAILED, SagaStatus.CANCELLED,
        SagaStatus.HUMAN_REVIEW_REQUIRED,
    },
    SagaStatus.HUMAN_REVIEW_REQUIRED: {
        SagaStatus.COMPLETED, SagaStatus.CANCELLED, SagaStatus.FAILED,
        SagaStatus.RUNNING,
    },
    SagaStatus.COMPLETED: {SagaStatus.COMPENSATED, SagaStatus.CANCELLED},
    SagaStatus.FAILED: {SagaStatus.COMPENSATED},
    SagaStatus.CANCELLED: {SagaStatus.COMPENSATED},
    SagaStatus.COMPENSATED: set(),
}


# Domain step order for the passenger journey.
JOURNEY_STEPS: List[Dict[str, Any]] = [
    {
        "step_index": 0,
        "name": "identity_verification",
        "agent_id": "identity_agent",
        "capability": "verify_identity",
        "event_type": "face_verify",
        "compensation": ["revoke_pass", "flag_passport"],
    },
    {
        "step_index": 1,
        "name": "baggage_screening",
        "agent_id": "baggage_agent",
        "capability": "screen_baggage",
        "event_type": "baggage_scan",
        "compensation": ["divert_bag", "lock_boarding_pass"],
    },
    {
        "step_index": 2,
        "name": "security_clearance",
        "agent_id": "safety_agent",
        "capability": "assess_safety",
        "event_type": "restricted_area",
        "compensation": ["lock_turnstile", "call_supervisor"],
    },
    {
        "step_index": 3,
        "name": "boarding",
        "agent_id": "flight_ops_agent",
        "capability": "update_flight_status",
        "event_type": "turnaround_milestone",
        "compensation": ["release_seat", "notify_passenger"],
    },
]

STEP_BY_NAME = {s["name"]: s for s in JOURNEY_STEPS}

# Compensation action -> (agent_id, capability) when an automated capability
# exists. Physical actions without a registered capability require manual
# intervention and are recorded as skipped (never silently completed).
COMPENSATION_CAPABILITIES: Dict[str, Optional[tuple]] = {
    "revoke_pass": ("notification_agent", "send_push_notification"),
    "flag_passport": None,
    "divert_bag": None,               # physical: requires IoT/MQTT (M2.6) or staff
    "lock_boarding_pass": ("notification_agent", "send_push_notification"),
    "lock_turnstile": None,           # physical: requires IoT/MQTT (M2.6) or staff
    "call_supervisor": ("notification_agent", "send_push_notification"),
    "release_seat": None,             # physical/operational: staff action
    "notify_passenger": ("notification_agent", "send_push_notification"),
}

DEFAULT_MAX_RETRIES = 3
STEP_TIMEOUT_SECONDS = 300


def _run_async(coro) -> Any:
    """Run an async coroutine on a fresh event loop (tests are sync)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            raise RuntimeError("event loop already running")
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


@dataclass
class SagaStepResult:
    step_index: int
    name: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    requires_human_review: bool = False


class SagaWorkflowEngine:
    """Executes and persists a compensable passenger-journey Saga."""

    def __init__(
        self,
        registry: AgentRegistry,
        event_system: EventSystem,
        session_factory: Callable[[], Session] = SessionLocal,
        hitl_manager: Optional[Any] = None,
    ):
        self.registry = registry
        self.event_system = event_system
        self._session_factory = session_factory or _SagaSessionLocal
        self.hitl_manager = hitl_manager
        self._instances: Dict[str, SagaInstance] = {}

    # ------------------------------------------------------------------ start

    def start_journey(
        self,
        *,
        correlation_id: str,
        passenger_id: int,
        booking_id: Optional[int] = None,
        flight_id: Optional[int] = None,
        input_payload: Optional[Dict[str, Any]] = None,
    ) -> SagaInstance:
        """Create (or return the existing) journey saga for a correlation id.

        Idempotent: repeated calls with the same correlation_id return the
        already-persisted instance and never duplicate steps.
        """
        existing = self._get_by_correlation(correlation_id)
        if existing is not None:
            return existing

        saga = SagaInstance(
            saga_id=f"saga_{uuid.uuid4().hex[:12]}",
            name="passenger_journey",
            correlation_id=correlation_id,
            passenger_id=passenger_id,
            booking_id=booking_id,
            flight_id=flight_id,
            status=SagaStatus.INITIATED,
            current_step_index=0,
            input_payload=json.dumps(input_payload or {}),
        )

        # Create saga + all step definitions in a single session so the
        # returned instance keeps its step collection without lazy loading
        # after the session closes (expire_on_commit=False).
        db = self._session_factory()
        try:
            db.add(saga)
            saga.status = SagaStatus.RUNNING
            saga.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(saga)
            steps = []
            for step_def in JOURNEY_STEPS:
                step = SagaStep(
                    step_id=f"step_{uuid.uuid4().hex[:12]}",
                    saga_id=saga.saga_id,
                    step_index=step_def["step_index"],
                    name=step_def["name"],
                    agent_id=step_def["agent_id"],
                    capability=step_def["capability"],
                    status=StepStatus.PENDING,
                    input_payload=json.dumps(self._step_input(step_def, saga)),
                    max_retries=DEFAULT_MAX_RETRIES,
                )
                db.add(step)
                db.commit()
                db.refresh(step)
                steps.append(step)
            saga.steps = steps
            saga.compensations = []
            self._instances[saga.saga_id] = saga
            return saga
        finally:
            db.close()

    # ------------------------------------------------------------------ resume

    def resume_saga(self, saga_id: str) -> Optional[SagaInstance]:
        """Resume a paused/failed saga from its current step.

        Safe restart recovery: loads persisted state and continues execution
        without re-running completed steps.
        """
        saga = self._get(saga_id)
        if saga is None:
            return None
        if saga.status in {SagaStatus.COMPLETED, SagaStatus.COMPENSATED}:
            return saga
        if saga.status == SagaStatus.FAILED and not self._has_pending_compensation(saga):
            # Nothing left to do; already terminal.
            return saga

        self._instances[saga.saga_id] = saga
        _run_async(self._execute(saga))
        return self._get(saga_id)

    def cancel_saga(self, saga_id: str) -> Optional[SagaInstance]:
        """Cancel a running saga and compensate completed steps."""
        saga = self._get(saga_id)
        if saga is None:
            return None
        if saga.status in {SagaStatus.COMPLETED, SagaStatus.COMPENSATED, SagaStatus.CANCELLED}:
            return saga
        self._transition(saga, SagaStatus.CANCELLED)
        self._compensate(saga)
        return self._get(saga_id)

    def get_saga(self, saga_id: str) -> Optional[Dict[str, Any]]:
        saga = self._get(saga_id)
        return self._serialize(saga) if saga else None

    def get_saga_by_correlation(self, correlation_id: str) -> Optional[Dict[str, Any]]:
        saga = self._get_by_correlation(correlation_id)
        return self._serialize(saga) if saga else None

    def list_sagas(self, limit: int = 50) -> List[Dict[str, Any]]:
        db = self._session_factory()
        try:
            rows = (
                db.query(SagaInstance)
                .order_by(SagaInstance.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._serialize_row(r) for r in rows]
        finally:
            db.close()

    # ------------------------------------------------------------------ execution

    async def _execute(self, saga: SagaInstance) -> None:
        """Run the saga from its current step until completion/pause/failure."""
        if saga.status not in {SagaStatus.RUNNING, SagaStatus.HUMAN_REVIEW_REQUIRED}:
            return

        while True:
            step = self._next_step(saga)
            if step is None:
                # All steps processed
                self._transition(saga, SagaStatus.COMPLETED)
                return

            if step.requires_human_review and step.status == StepStatus.NEEDS_REVIEW:
                self._transition(saga, SagaStatus.HUMAN_REVIEW_REQUIRED)
                return  # pause for HITL (M2.7)

            result = await self._run_step(saga, step)
            saga.current_step_index = step.step_index + 1
            self._persist_saga(saga)

            if result.requires_human_review and not self._step_approved(step):
                was_needs_review = step.status == StepStatus.NEEDS_REVIEW
                step.status = StepStatus.NEEDS_REVIEW
                step.requires_human_review = True
                self._persist_step(step)
                self._record_decision(saga, step, result, human_reviewed=False)
                # Create a persistent HITL review request (first time only).
                if (
                    not was_needs_review
                    and self.hitl_manager is not None
                    and saga.passenger_id is not None
                ):
                    self.hitl_manager.create_review(
                        correlation_id=saga.correlation_id,
                        step_name=step.name,
                        agent_id=step.agent_id,
                        evidence={
                            "saga_id": saga.saga_id,
                            "step": step.name,
                            "result": result.result,
                            "error": result.error,
                            "passenger_id": saga.passenger_id,
                            "flight_id": saga.flight_id,
                        },
                        confidence=(result.result or {}).get("confidence") if result.result else None,
                        requested_reason="agent requested human review",
                        saga_id=saga.saga_id,
                        event_id=None,
                    )
                self._transition(saga, SagaStatus.HUMAN_REVIEW_REQUIRED)
                self._publish_step_event(saga, step, result)
                return  # pause for HITL

            if result.status == StepStatus.COMPLETED:
                step.status = StepStatus.COMPLETED
                self._persist_step(step)
                self._record_decision(saga, step, result, human_reviewed=False)
                self._publish_step_event(saga, step, result)
                continue  # next step

            # Step failed after retries -> compensate completed steps and fail.
            step.status = StepStatus.FAILED
            self._persist_step(step)
            self._record_decision(saga, step, result, human_reviewed=False)
            self._publish_step_event(saga, step, result, error=result.error)
            self._transition(saga, SagaStatus.FAILED)
            self._compensate(saga)
            return

    def approve_step(self, saga_id: str, step_name: str, *, staff_id: int,
                     reason: Optional[str] = None) -> Optional[SagaInstance]:
        """HITL entry: approve a needs-review step and resume execution."""
        saga = self._get(saga_id)
        if saga is None:
            return None
        step = self._find_step(saga, step_name)
        if step is None or step.status != StepStatus.NEEDS_REVIEW:
            return saga
        step.status = StepStatus.COMPLETED
        step.requires_human_review = False
        self._persist_step(step)
        self._record_decision(saga, step, SagaStepResult(
            step.step_index, step.name, StepStatus.COMPLETED,
            result={"decision": "approved", "reason": reason or "human_override"},
        ), human_reviewed=True, staff_id=staff_id)
        self._transition(saga, SagaStatus.RUNNING)
        _run_async(self._execute(saga))
        return self.get_saga(saga_id)

    def reject_step(self, saga_id: str, step_name: str, *, staff_id: int,
                    reason: Optional[str] = None) -> Optional[SagaInstance]:
        """HITL entry: reject a needs-review step and compensate."""
        saga = self._get(saga_id)
        if saga is None:
            return None
        step = self._find_step(saga, step_name)
        if step is None or step.status != StepStatus.NEEDS_REVIEW:
            return saga
        step.status = StepStatus.FAILED
        self._persist_step(step)
        self._record_decision(saga, step, SagaStepResult(
            step.step_index, step.name, StepStatus.FAILED,
            error="rejected by human reviewer",
            result={"decision": "rejected", "reason": reason or "human_override"},
        ), human_reviewed=True, staff_id=staff_id)
        self._transition(saga, SagaStatus.FAILED)
        self._compensate(saga)
        return self.get_saga(saga_id)

    # ------------------------------------------------------------------ step execution

    async def _run_step(self, saga: SagaInstance, step: SagaStep) -> SagaStepResult:
        agent = self.registry.get(step.agent_id)
        if agent is None or not agent.is_healthy():
            return SagaStepResult(
                step.step_index, step.name, StepStatus.FAILED,
                error=f"Agent {step.agent_id} not available",
            )

        step.status = StepStatus.RUNNING
        step.started_at = datetime.now(timezone.utc)
        self._persist_step(step)

        payload = json.loads(step.input_payload or "{}")
        attempt = 0
        last_error: Optional[str] = None
        result: Optional[AgentResult] = None

        while attempt <= step.max_retries:
            attempt += 1
            try:
                result = await asyncio.wait_for(
                    agent.execute_with_guard(
                        event_type=STEP_BY_NAME[step.name]["event_type"],
                        payload={**payload, "step": step.name},
                    ),
                    timeout=STEP_TIMEOUT_SECONDS,
                )
            except asyncio.TimeoutError:
                last_error = "execution timeout"
                if attempt > step.max_retries:
                    break
                continue
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                if attempt > step.max_retries:
                    break
                continue

            if result.success:
                step.completed_at = datetime.now(timezone.utc)
                step.output_payload = json.dumps(result.to_dict())
                step.retry_count = attempt - 1
                self._persist_step(step)
                return SagaStepResult(
                    step.step_index, step.name, StepStatus.COMPLETED,
                    result=result.to_dict(),
                    requires_human_review=bool(result.requires_human_review),
                )

            if result.service_unavailable:
                last_error = result.error or "service unavailable"
                if attempt >= step.max_retries:
                    break
                continue

            # Non-retryable failure (validation error, no handler)
            last_error = result.error or "step failed"
            break

        step.retry_count = attempt - 1
        step.error_message = last_error or "step failed after retries"
        self._persist_step(step)
        return SagaStepResult(
            step.step_index, step.name, StepStatus.FAILED,
            error=step.error_message,
        )

    # ------------------------------------------------------------------ compensation

    def _compensate(self, saga: SagaInstance) -> None:
        """Compensate completed steps in reverse order."""
        completed = [s for s in saga.steps if s.status == StepStatus.COMPLETED]
        for step in reversed(completed):
            step_def = STEP_BY_NAME[step.name]
            for action in step_def["compensation"]:
                self._execute_compensation(saga, step, action)

        # Only mark compensated when compensations were actually due.
        # A failed/cancelled saga with no completed steps stays terminal.
        if completed and saga.status != SagaStatus.CANCELLED:
            self._transition(saga, SagaStatus.COMPENSATED)

    def _execute_compensation(
        self, saga: SagaInstance, step: SagaStep, action: str
    ) -> None:
        comp = SagaCompensation(
            compensation_id=f"comp_{uuid.uuid4().hex[:12]}",
            saga_id=saga.saga_id,
            step_id=step.step_id,
            action=action,
            status="pending",
            input_payload=json.dumps({"step": step.name, "saga_id": saga.saga_id}),
        )
        self._persist_compensation(comp)

        cap = COMPENSATION_CAPABILITIES.get(action)
        if cap is None:
            # Physical / manual compensation: cannot be automated safely.
            comp.status = "skipped"
            comp.error_message = (
                f"No automated capability registered for '{action}'; "
                "requires manual intervention (IoT/physical action or staff)."
            )
            comp.executed_at = datetime.now(timezone.utc)
            self._persist_compensation(comp)
            return

        agent_id, capability = cap
        agent = self.registry.get(agent_id)
        if agent is None or not agent.is_healthy():
            comp.status = "failed"
            comp.error_message = f"Compensation agent {agent_id} not available"
            comp.executed_at = datetime.now(timezone.utc)
            self._persist_compensation(comp)
            return

        try:
            result = _run_async(asyncio.wait_for(
                agent.execute_with_guard(
                    event_type=_compensation_event(action),
                    payload={
                        "saga_id": saga.saga_id,
                        "step": step.name,
                        "action": action,
                    },
                ),
                timeout=STEP_TIMEOUT_SECONDS,
            ))
            comp.output_payload = json.dumps(result.to_dict() if result else {})
            comp.status = "completed" if (result and result.success) else "failed"
            comp.error_message = None if (result and result.success) else (
                result.error if result else "no result"
            )
        except asyncio.TimeoutError:
            comp.status = "failed"
            comp.error_message = "compensation timeout"
        except Exception as exc:  # noqa: BLE001
            comp.status = "failed"
            comp.error_message = str(exc)
        comp.executed_at = datetime.now(timezone.utc)
        self._persist_compensation(comp)

    # ------------------------------------------------------------------ helpers

    def _next_step(self, saga: SagaInstance) -> Optional[SagaStep]:
        for step in saga.steps:
            if step.status in {StepStatus.PENDING, StepStatus.RUNNING}:
                return step
        return None

    def _find_step(self, saga: SagaInstance, step_name: str) -> Optional[SagaStep]:
        for step in saga.steps:
            if step.name == step_name:
                return step
        return None

    def _step_approved(self, step: SagaStep) -> bool:
        return step.status == StepStatus.COMPLETED

    def _has_pending_compensation(self, saga: SagaInstance) -> bool:
        return any(s.status == StepStatus.COMPLETED for s in saga.steps)

    def _transition(self, saga: SagaInstance, new_status: str) -> None:
        if new_status not in ALL_STATUSES:
            raise ValueError(f"Unknown saga status: {new_status}")
        allowed = LEGAL_TRANSITIONS.get(saga.status, set())
        if new_status not in allowed and new_status != saga.status:
            raise ValueError(
                f"Illegal saga transition {saga.status} -> {new_status}"
            )
        saga.status = new_status
        saga.updated_at = datetime.now(timezone.utc)
        if new_status in {SagaStatus.COMPLETED, SagaStatus.FAILED,
                          SagaStatus.CANCELLED, SagaStatus.COMPENSATED}:
            saga.completed_at = datetime.now(timezone.utc)
        self._persist_saga(saga)

    def _step_input(self, step_def: Dict[str, Any], saga: SagaInstance) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "saga_id": saga.saga_id,
            "correlation_id": saga.correlation_id,
            "step": step_def["name"],
        }
        if saga.passenger_id:
            payload["passenger_id"] = saga.passenger_id
        if saga.booking_id:
            payload["booking_id"] = saga.booking_id
        if saga.flight_id:
            payload["flight_id"] = saga.flight_id
        if saga.input_payload:
            try:
                payload.update(json.loads(saga.input_payload))
            except Exception:
                pass
        return payload

    def _record_decision(
        self, saga: SagaInstance, step: SagaStep, result: SagaStepResult,
        human_reviewed: bool = False, staff_id: Optional[int] = None,
    ) -> None:
        decision = "verified" if result.status == StepStatus.COMPLETED else "review"
        confidence = None
        if result.result and isinstance(result.result, dict):
            confidence = result.result.get("confidence")
        db = self._session_factory()
        try:
            row = MDecisionAudit(
                workflow_id=saga.saga_id,
                task_id=step.step_id,
                agent_id=step.agent_id,
                decision=decision,
                rationale=result.error or "step executed successfully",
                confidence=confidence,
                requires_human_review=bool(result.requires_human_review),
                human_reviewed_by=staff_id,
                human_reviewed_at=datetime.now(timezone.utc) if human_reviewed else None,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def _publish_step_event(
        self, saga: SagaInstance, step: SagaStep, result: SagaStepResult,
        error: Optional[str] = None,
    ) -> None:
        event = AirportEvent.create(
            event_type=f"saga.{step.name}.{result.status}",
            source="saga_engine",
            source_id=step.agent_id,
            correlation_id=saga.correlation_id,
            payload={
                "saga_id": saga.saga_id,
                "step_id": step.step_id,
                "step_index": step.step_index,
                "step": step.name,
                "status": result.status,
                "result": result.result,
                "error": error or result.error,
                "passenger_id": saga.passenger_id,
                "flight_id": saga.flight_id,
            },
            severity=EventSeverity.INFO.value if result.status == StepStatus.COMPLETED else EventSeverity.HIGH.value,
            passenger_id=saga.passenger_id,
            flight_id=saga.flight_id,
        )
        try:
            self.event_system.publish(event)
        except Exception:  # noqa: BLE001
            pass

    # ------------------------------------------------------------------ persistence

    def _get(self, saga_id: str) -> Optional[SagaInstance]:
        # Always read fresh from the DB so compensations/steps written during
        # execution are reflected (the in-memory cache can go stale).
        db = self._session_factory()
        try:
            row = db.query(SagaInstance).filter(SagaInstance.saga_id == saga_id).first()
            if row is None:
                return None
            self._load_steps(db, row)
            self._instances[row.saga_id] = row
            return row
        finally:
            db.close()

    def _get_by_correlation(self, correlation_id: str) -> Optional[SagaInstance]:
        db = self._session_factory()
        try:
            row = (
                db.query(SagaInstance)
                .filter(SagaInstance.correlation_id == correlation_id)
                .order_by(SagaInstance.created_at.desc())
                .first()
            )
            if row is None:
                return None
            self._load_steps(db, row)
            self._instances[row.saga_id] = row
            return row
        finally:
            db.close()

    def _load_steps(self, db: Session, saga: SagaInstance) -> None:
        steps = (
            db.query(SagaStep)
            .filter(SagaStep.saga_id == saga.saga_id)
            .order_by(SagaStep.step_index)
            .all()
        )
        comps = (
            db.query(SagaCompensation)
            .filter(SagaCompensation.saga_id == saga.saga_id)
            .all()
        )
        saga.steps = steps
        saga.compensations = comps

    def _persist_saga(self, saga: SagaInstance) -> None:
        db = self._session_factory()
        try:
            exists = db.query(SagaInstance).filter(SagaInstance.saga_id == saga.saga_id).first()
            if exists:
                exists.status = saga.status
                exists.current_step_index = saga.current_step_index
                exists.output_payload = saga.output_payload
                exists.error_message = saga.error_message
                exists.updated_at = saga.updated_at
                exists.completed_at = saga.completed_at
                db.commit()
                return
            db.add(saga)
            db.commit()
        finally:
            db.close()

    def _persist_step(self, step: SagaStep) -> None:
        db = self._session_factory()
        try:
            exists = db.query(SagaStep).filter(SagaStep.step_id == step.step_id).first()
            if exists:
                exists.status = step.status
                exists.output_payload = step.output_payload
                exists.error_message = step.error_message
                exists.retry_count = step.retry_count
                exists.started_at = step.started_at
                exists.completed_at = step.completed_at
                exists.requires_human_review = step.requires_human_review
                db.commit()
                return
            db.add(step)
            db.commit()
        finally:
            db.close()

    def _persist_compensation(self, comp: SagaCompensation) -> None:
        db = self._session_factory()
        try:
            db.add(comp)
            db.commit()
        finally:
            db.close()

    # ------------------------------------------------------------------ serialization

    def _serialize(self, saga: SagaInstance) -> Dict[str, Any]:
        return self._serialize_row(saga)

    def _serialize_row(self, r: SagaInstance) -> Dict[str, Any]:
        return {
            "saga_id": r.saga_id,
            "name": r.name,
            "correlation_id": r.correlation_id,
            "passenger_id": r.passenger_id,
            "booking_id": r.booking_id,
            "flight_id": r.flight_id,
            "status": r.status,
            "current_step_index": r.current_step_index,
            "input_payload": json.loads(r.input_payload or "{}"),
            "output_payload": json.loads(r.output_payload or "{}") if r.output_payload else None,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "steps": [
                {
                    "step_id": s.step_id,
                    "step_index": s.step_index,
                    "name": s.name,
                    "agent_id": s.agent_id,
                    "capability": s.capability,
                    "status": s.status,
                    "input_payload": json.loads(s.input_payload or "{}"),
                    "output_payload": json.loads(s.output_payload or "{}") if s.output_payload else None,
                    "error_message": s.error_message,
                    "retry_count": s.retry_count,
                    "max_retries": s.max_retries,
                    "requires_human_review": s.requires_human_review,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                }
                for s in (r.steps or [])
            ],
            "compensations": [
                {
                    "compensation_id": c.compensation_id,
                    "step_id": c.step_id,
                    "action": c.action,
                    "status": c.status,
                    "input_payload": json.loads(c.input_payload or "{}"),
                    "output_payload": json.loads(c.output_payload or "{}") if c.output_payload else None,
                    "error_message": c.error_message,
                    "executed_at": c.executed_at.isoformat() if c.executed_at else None,
                }
                for c in (r.compensations or [])
            ],
        }


class SagaCompensationStatus(str):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


def _compensation_event(action: str) -> str:
    return f"saga.compensation.{action}"
