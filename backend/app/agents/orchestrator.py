"""Agent orchestrator — deterministic event routing and workflow execution.

Responsibilities:
  - Receive and classify airport events
  - Route events to the appropriate agents by capability
  - Execute multi-step workflows (identity, baggage, safety)
  - Coordinate agents when a workflow spans multiple systems
  - Track task states and execution results
  - Handle failures, timeouts, retries, and duplicate events
  - Support safe cancellation and recovery
  - Prevent uncontrolled execution loops (max steps, visited-task guard)

Orchestration is deterministic (rule-based). LLM-based planning is NOT used,
consistent with the project's safety requirements.
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.agents import (
    AgentDefinition as MAgentDefinition,
    AgentTask as MAgentTask,
    AgentExecution as MAgentExecution,
    AirportEvent as MAirportEvent,
    WorkflowExecution as MWorkflowExecution,
    DecisionAudit as MDecisionAudit,
)
from ..models.admin_cameras import EmergencyEvent as MEmergencyEvent
from ..models.admin_cameras import MonitoringAlert as MMonitoringAlert
from .base import AgentInterface, AgentResult, AgentStatus
from .registry import AgentRegistry
from .events import AirportEvent, EventSystem, EventSource, EventSeverity
from .twin_publisher import TwinPublisher


class WorkflowStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Deterministic routing: event_type -> required capability name
EVENT_CAPABILITY_MAP: Dict[str, str] = {
    "face_verify": "verify_identity",
    "passport_scan": "verify_identity",
    "baggage_scan": "screen_baggage",
    "baggage_tracking": "track_baggage",
    "smoke_detected": "assess_safety",
    "fire_detected": "assess_safety",
    "fall_detected": "assess_safety",
    "restricted_area": "assess_safety",
    "unattended_bag": "assess_safety",
    "overcrowding": "assess_safety",
    "iot_telemetry": "assess_safety",
}

MAX_WORKFLOW_STEPS = 10
DEFAULT_TIMEOUT_SECONDS = 300


@dataclass
class WorkflowStep:
    step_index: int
    task_id: str
    agent_id: str
    task_type: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class WorkflowContext:
    workflow_id: str
    name: str
    correlation_id: str
    status: str
    steps: List[WorkflowStep] = field(default_factory=list)
    current_step: Optional[str] = None
    input_payload: Dict[str, Any] = field(default_factory=dict)
    output_payload: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class AgentOrchestrator:
    """Routes events to agents and executes deterministic workflows."""

    def __init__(
        self,
        registry: AgentRegistry,
        event_system: EventSystem,
        twin_publisher: Optional[TwinPublisher] = None,
    ):
        self.registry = registry
        self.event_system = event_system
        self.twin_publisher = twin_publisher
        self._workflows: Dict[str, WorkflowContext] = {}
        self._running_tasks: Dict[str, asyncio.Task] = {}
        self._step_guard: set = set()  # (workflow_id, task_id) to prevent loops

    # ----- event intake -----

    async def ingest_event(
        self,
        event_type: str,
        source: str,
        payload: Dict[str, Any] | None = None,
        source_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        severity: str = EventSeverity.INFO.value,
        zone_id: Optional[int] = None,
        camera_id: Optional[int] = None,
        passenger_id: Optional[int] = None,
        bag_id: Optional[int] = None,
        flight_id: Optional[int] = None,
    ) -> AirportEvent:
        """Create, persist, and route an airport event."""
        event = AirportEvent.create(
            event_type=event_type,
            source=source,
            payload=payload or {},
            source_id=source_id,
            correlation_id=correlation_id,
            severity=severity,
            zone_id=zone_id,
            camera_id=camera_id,
            passenger_id=passenger_id,
            bag_id=bag_id,
            flight_id=flight_id,
        )
        self.event_system.publish(event)

        # Persist task + route synchronously so the caller knows the outcome
        self._persist_event(event)
        try:
            await self._route_event(event)
        except Exception as exc:  # noqa: BLE001
            # Routing failure must not break event ingestion
            import logging
            logging.getLogger(__name__).error(f"Route error: {exc}")
        return event

    # ----- routing -----

    async def _route_event(self, event: AirportEvent) -> None:
        required_cap = EVENT_CAPABILITY_MAP.get(event.event_type)
        if not required_cap:
            self._record_no_handler(event)
            return

        agents = self.registry.find_by_capability(required_cap)
        if not agents:
            self._record_no_handler(event)
            return

        # Pick the first healthy agent with the capability
        agent = agents[0]
        await self._start_workflow_for_event(event, agent)

    def _record_no_handler(self, event: AirportEvent) -> None:
        db = SessionLocal()
        try:
            row = db.query(MAirportEvent).filter(MAirportEvent.event_id == event.event_id).first()
            if row:
                row.status = "dismissed"
                db.commit()
        finally:
            db.close()

    # ----- workflow execution -----

    async def _start_workflow_for_event(self, event: AirportEvent, agent: AgentInterface) -> None:
        workflow_id = f"wf_{uuid4().hex[:12]}"
        name = self._workflow_name_for(event.event_type)
        ctx = WorkflowContext(
            workflow_id=workflow_id,
            name=name,
            correlation_id=event.correlation_id,
            status=WorkflowStatus.RUNNING.value,
            input_payload=event.payload,
        )
        self._workflows[workflow_id] = ctx

        # Persist workflow execution
        self._persist_workflow(ctx)

        # Step 1: create a task for the agent
        step = await self._execute_step(ctx, step_index=0, agent=agent, event=event)
        ctx.steps.append(step)
        ctx.current_step = step.task_id

        if step.status == TaskStatus.COMPLETED.value:
            # Step 2: publish result to Digital Twin + downstream systems
            await self._publish_step_result(ctx, step, event)
            ctx.status = WorkflowStatus.COMPLETED.value
        elif step.status == TaskStatus.FAILED.value:
            ctx.status = WorkflowStatus.FAILED.value
            ctx.error_message = step.error
        else:
            ctx.status = WorkflowStatus.FAILED.value
            ctx.error_message = step.error or "unknown failure"

        ctx.completed_at = datetime.now(timezone.utc)
        self._persist_workflow(ctx)
        self.event_system.mark_resolved(event.event_id)

    async def _execute_step(
        self,
        ctx: WorkflowContext,
        step_index: int,
        agent: AgentInterface,
        event: AirportEvent,
    ) -> WorkflowStep:
        """Execute a single deterministic step with timeout and retry guard."""
        guard_key = (ctx.workflow_id, f"step_{step_index}")
        if guard_key in self._step_guard:
            return WorkflowStep(
                step_index=step_index,
                task_id=f"task_{uuid4().hex[:12]}",
                agent_id=agent.agent_id,
                task_type=event.event_type,
                status=TaskStatus.FAILED.value,
                error="execution loop guard triggered",
            )
        self._step_guard.add(guard_key)

        if len(ctx.steps) >= MAX_WORKFLOW_STEPS:
            return WorkflowStep(
                step_index=step_index,
                task_id=f"task_{uuid4().hex[:12]}",
                agent_id=agent.agent_id,
                task_type=event.event_type,
                status=TaskStatus.FAILED.value,
                error="max workflow steps exceeded",
            )

        task_id = f"task_{uuid4().hex[:12]}"
        task_type = EVENT_CAPABILITY_MAP.get(event.event_type, event.event_type)

        # Persist task
        self._persist_task(task_id, ctx.workflow_id, agent.agent_id, event.event_id, task_type, event.payload)

        result: AgentResult
        try:
            result = await asyncio.wait_for(
                agent.execute_with_guard(
                    event_type=event.event_type,
                    payload={**event.payload, "event_type": event.event_type},
                ),
                timeout=DEFAULT_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            self._update_task_status(task_id, TaskStatus.FAILED.value, error="execution timeout")
            return WorkflowStep(
                step_index=step_index,
                task_id=task_id,
                agent_id=agent.agent_id,
                task_type=task_type,
                status=TaskStatus.FAILED.value,
                error="execution timeout",
            )
        except Exception as exc:  # noqa: BLE001
            self._update_task_status(task_id, TaskStatus.FAILED.value, error=str(exc))
            return WorkflowStep(
                step_index=step_index,
                task_id=task_id,
                agent_id=agent.agent_id,
                task_type=task_type,
                status=TaskStatus.FAILED.value,
                error=str(exc),
            )

        self._update_task_status(
            task_id,
            TaskStatus.COMPLETED.value if result.success else TaskStatus.FAILED.value,
            output=json.dumps(result.to_dict()),
            error=result.error,
        )

        # Record decision audit
        self._record_decision(ctx.workflow_id, task_id, agent.agent_id, result)

        return WorkflowStep(
            step_index=step_index,
            task_id=task_id,
            agent_id=agent.agent_id,
            task_type=task_type,
            status=TaskStatus.COMPLETED.value if result.success else TaskStatus.FAILED.value,
            result=result.to_dict(),
            error=result.error,
        )

    async def _publish_step_result(
        self,
        ctx: WorkflowContext,
        step: WorkflowStep,
        event: AirportEvent,
    ) -> None:
        """Publish agent result to Digital Twin and notification systems."""
        if not step.result:
            return

        data = step.result.get("data", {})

        # Persist a downstream event for the Digital Twin consumer.
        twin_event = AirportEvent.create(
            event_type=f"{event.event_type}.completed",
            source="agent",
            source_id=step.agent_id,
            correlation_id=ctx.correlation_id,
            payload={
                "workflow_id": ctx.workflow_id,
                "task_id": step.task_id,
                "agent_id": step.agent_id,
                "result": data,
                "original_event": event.event_id,
            },
            severity=EventSeverity.INFO.value,
            zone_id=event.zone_id,
            camera_id=event.camera_id,
            passenger_id=event.passenger_id,
            bag_id=event.bag_id,
            flight_id=event.flight_id,
        )
        self.event_system.publish(twin_event)

        # Push the structured state change to the Digital Twin REST API
        # (airport-twin :8100). Failure here is non-fatal: the twin is
        # visualization-only and the agent workflow continues.
        if self.twin_publisher is not None:
            import asyncio as _asyncio

            try:
                await _asyncio.wait_for(
                    self.twin_publisher.publish_agent_event(
                        asset_code=f"bag-{event.bag_id}" if event.bag_id else "bag-unknown",
                        event_type=f"{event.event_type}.completed",
                        payload=data,
                    ),
                    timeout=10.0,
                )
            except Exception:  # noqa: BLE001
                # Twin unreachable — non-fatal; event is still persisted above.
                pass

    # ----- persistence helpers -----

    def _persist_event(self, event: AirportEvent) -> None:
        db = SessionLocal()
        try:
            exists = db.query(MAirportEvent).filter(MAirportEvent.event_id == event.event_id).first()
            if exists:
                return
            row = MAirportEvent(
                event_id=event.event_id,
                event_type=event.event_type,
                source=event.source,
                source_id=event.source_id,
                correlation_id=event.correlation_id,
                payload=json.dumps(event.payload),
                status=event.status,
                severity=event.severity,
                zone_id=event.zone_id,
                camera_id=event.camera_id,
                passenger_id=event.passenger_id,
                bag_id=event.bag_id,
                flight_id=event.flight_id,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def _persist_workflow(self, ctx: WorkflowContext) -> None:
        db = SessionLocal()
        try:
            exists = db.query(MWorkflowExecution).filter(MWorkflowExecution.workflow_id == ctx.workflow_id).first()
            if exists:
                return
            row = MWorkflowExecution(
                workflow_id=ctx.workflow_id,
                name=ctx.name,
                status=ctx.status,
                correlation_id=ctx.correlation_id,
                input_payload=json.dumps(ctx.input_payload),
                output_payload=json.dumps(ctx.output_payload),
                current_step=ctx.current_step,
                steps_completed=json.dumps([s.task_id for s in ctx.steps]),
                started_at=ctx.started_at,
                completed_at=ctx.completed_at,
                error_message=ctx.error_message,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def _persist_task(
        self,
        task_id: str,
        workflow_id: str,
        agent_id: str,
        event_id: Optional[str],
        task_type: str,
        input_payload: Dict[str, Any],
    ) -> None:
        db = SessionLocal()
        try:
            row = MAgentTask(
                task_id=task_id,
                agent_id=agent_id,
                event_id=event_id,
                task_type=task_type,
                status=TaskStatus.RUNNING.value,
                input_payload=json.dumps(input_payload),
                timeout_seconds=DEFAULT_TIMEOUT_SECONDS,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    def _update_task_status(
        self,
        task_id: str,
        status: str,
        output: Optional[str] = None,
        error: Optional[str] = None,
    ) -> None:
        db = SessionLocal()
        try:
            row = db.query(MAgentTask).filter(MAgentTask.task_id == task_id).first()
            if row:
                row.status = status
                row.completed_at = datetime.now(timezone.utc)
                if output is not None:
                    row.output_payload = output
                if error is not None:
                    row.error_message = error
                db.commit()
        finally:
            db.close()

    def _record_decision(
        self,
        workflow_id: str,
        task_id: str,
        agent_id: str,
        result: AgentResult,
    ) -> None:
        db = SessionLocal()
        try:
            row = MDecisionAudit(
                workflow_id=workflow_id,
                task_id=task_id,
                agent_id=agent_id,
                decision="verified" if result.success else "review",
                rationale=result.error or "agent executed successfully",
                confidence=result.confidence,
                requires_human_review=result.requires_human_review,
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    # ----- observability -----

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        ctx = self._workflows.get(workflow_id)
        if ctx:
            return {
                "workflow_id": ctx.workflow_id,
                "name": ctx.name,
                "status": ctx.status,
                "correlation_id": ctx.correlation_id,
                "current_step": ctx.current_step,
                "steps": [
                    {
                        "step_index": s.step_index,
                        "task_id": s.task_id,
                        "agent_id": s.agent_id,
                        "task_type": s.task_type,
                        "status": s.status,
                        "result": s.result,
                        "error": s.error,
                    }
                    for s in ctx.steps
                ],
                "started_at": ctx.started_at.isoformat(),
                "completed_at": ctx.completed_at.isoformat() if ctx.completed_at else None,
                "error_message": ctx.error_message,
            }
        # Fall back to DB
        db = SessionLocal()
        try:
            row = db.query(MWorkflowExecution).filter(MWorkflowExecution.workflow_id == workflow_id).first()
            if not row:
                return None
            return {
                "workflow_id": row.workflow_id,
                "name": row.name,
                "status": row.status,
                "correlation_id": row.correlation_id,
                "current_step": row.current_step,
                "steps": json.loads(row.steps_completed or "[]"),
                "started_at": row.started_at.isoformat() if row.started_at else None,
                "completed_at": row.completed_at.isoformat() if row.completed_at else None,
                "error_message": row.error_message,
            }
        finally:
            db.close()

    def list_workflows(self, limit: int = 50) -> List[Dict[str, Any]]:
        db = SessionLocal()
        try:
            rows = (
                db.query(MWorkflowExecution)
                .order_by(MWorkflowExecution.started_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "workflow_id": r.workflow_id,
                    "name": r.name,
                    "status": r.status,
                    "correlation_id": r.correlation_id,
                    "current_step": r.current_step,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "error_message": r.error_message,
                }
                for r in rows
            ]
        finally:
            db.close()

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        db = SessionLocal()
        try:
            row = db.query(MAgentTask).filter(MAgentTask.task_id == task_id).first()
            if not row:
                return None
            return {
                "task_id": row.task_id,
                "agent_id": row.agent_id,
                "event_id": row.event_id,
                "task_type": row.task_type,
                "status": row.status,
                "input_payload": json.loads(row.input_payload or "{}"),
                "output_payload": json.loads(row.output_payload or "{}") if row.output_payload else None,
                "error_message": row.error_message,
                "retry_count": row.retry_count,
                "max_retries": row.max_retries,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "completed_at": row.completed_at.isoformat() if row.completed_at else None,
            }
        finally:
            db.close()

    def _workflow_name_for(self, event_type: str) -> str:
        mapping = {
            "face_verify": "identity_verification",
            "passport_scan": "identity_verification",
            "baggage_scan": "baggage_screening",
            "baggage_tracking": "baggage_tracking",
            "smoke_detected": "safety_response",
            "fire_detected": "safety_response",
            "fall_detected": "safety_response",
            "restricted_area": "safety_response",
            "unattended_bag": "safety_response",
            "overcrowding": "safety_response",
        }
        return mapping.get(event_type, f"generic_{event_type}")
