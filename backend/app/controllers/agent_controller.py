"""Agent observability and control endpoints.

Endpoints (all under /api/v1/agents):
  GET    /agents/registry          — registered agents + health
  GET    /agents/agents/{agent_id} — single agent detail
  GET    /agents/tasks/{task_id}   — task status
  GET    /agents/workflows/{id}    — workflow status
  GET    /agents/workflows         — list recent workflows
  GET    /agents/events            — recent airport events (filterable)
  GET    /agents/health            — twin + agent service connectivity
  POST   /agents/events            — ingest a new airport event
  POST   /agents/agents/{agent_id}/heartbeat — agent heartbeat
  GET    /agents/snapshot          — full observability snapshot

Protected by the existing X-API-KEY authentication (same as other AI/IoT
endpoints). No sensitive passenger data is exposed through public endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Body, Query
from pydantic import BaseModel

from ..utils.auth import verify_api_key
from ..utils.response_envelope import success_response, error_response
from ..utils.errors import AirportException
from ..agents.service import agent_service

router = APIRouter()


class IngestEventRequest(BaseModel):
    event_type: str
    source: str = "api"
    payload: Optional[Dict[str, Any]] = None
    source_id: Optional[str] = None
    correlation_id: Optional[str] = None
    severity: str = "info"
    zone_id: Optional[int] = None
    camera_id: Optional[int] = None
    passenger_id: Optional[int] = None
    bag_id: Optional[int] = None
    flight_id: Optional[int] = None


@router.get("/registry", dependencies=[Depends(verify_api_key)])
def agent_registry():
    """List all registered agents with capabilities and health."""
    try:
        reg = agent_service.get_registry()
        return success_response(data=reg.snapshot())
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
def agent_detail(agent_id: str):
    """Get detail for a single agent."""
    try:
        reg = agent_service.get_registry()
        agent = reg.get(agent_id)
        if not agent:
            return error_response(code="AGENT_NOT_FOUND", message=f"Agent {agent_id} not found", status_code=404)
        return success_response(data=agent.to_registry_entry())
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/tasks/{task_id}", dependencies=[Depends(verify_api_key)])
def task_status(task_id: str):
    """Get status of an agent task."""
    try:
        orch = agent_service.get_orchestrator()
        task = orch.get_task(task_id)
        if not task:
            return error_response(code="TASK_NOT_FOUND", message=f"Task {task_id} not found", status_code=404)
        return success_response(data=task)
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/workflows/{workflow_id}", dependencies=[Depends(verify_api_key)])
def workflow_status(workflow_id: str):
    """Get status of a workflow execution."""
    try:
        orch = agent_service.get_orchestrator()
        wf = orch.get_workflow(workflow_id)
        if not wf:
            return error_response(code="WORKFLOW_NOT_FOUND", message=f"Workflow {workflow_id} not found", status_code=404)
        return success_response(data=wf)
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/workflows", dependencies=[Depends(verify_api_key)])
def list_workflows(limit: int = 50):
    """List recent workflow executions."""
    try:
        orch = agent_service.get_orchestrator()
        return success_response(data=orch.list_workflows(limit=limit))
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/events", dependencies=[Depends(verify_api_key)])
def recent_events(
    limit: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = Query(None, description="Filter by event type (e.g. face_verify, baggage_scan, fall_detected)"),
    severity: Optional[str] = Query(None, description="Filter by severity (info, low, medium, high, critical)"),
    status: Optional[str] = Query(None, description="Filter by status (received, processing, resolved, dismissed)"),
    source: Optional[str] = Query(None, description="Filter by source (api, ai_service, iot_device, agent, system)"),
):
    """List recent airport events with optional filtering."""
    try:
        es = agent_service.get_event_system()
        return success_response(data=es.get_recent(
            limit=limit,
            event_type=event_type,
            severity=severity,
            status=status,
            source=source,
        ))
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/health", dependencies=[Depends(verify_api_key)])
def agent_health():
    """Agent service connectivity and registry health."""
    try:
        reg = agent_service.get_registry()
        snapshot = reg.snapshot()

        # Agent health summary
        agents = snapshot.get("agents", [])
        agent_statuses = {}
        for a in agents:
            agent_statuses[a["agent_id"]] = {
                "status": a["status"],
                "capabilities": [c["name"] for c in a.get("capabilities", [])],
                "requires_human_review": any(c.get("requires_human_review", False) for c in a.get("capabilities", [])),
            }

        overall = "healthy"
        for a in agents:
            if a["status"] != "active":
                overall = "degraded"

        return success_response(data={
            "overall": overall,
            "agents": agent_statuses,
            "agent_count": len(agents),
            "active_agents": snapshot.get("active", 0),
        })
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.post("/events", dependencies=[Depends(verify_api_key)])
async def ingest_event(req: IngestEventRequest):
    """Ingest a new airport event and route it to the appropriate agent."""
    try:
        orch = agent_service.get_orchestrator()
        event = await orch.ingest_event(
            event_type=req.event_type,
            source=req.source,
            payload=req.payload,
            source_id=req.source_id,
            correlation_id=req.correlation_id,
            severity=req.severity,
            zone_id=req.zone_id,
            camera_id=req.camera_id,
            passenger_id=req.passenger_id,
            bag_id=req.bag_id,
            flight_id=req.flight_id,
        )
        return success_response(data={
            "event_id": event.event_id,
            "event_type": event.event_type,
            "correlation_id": event.correlation_id,
            "status": event.status,
        })
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="EVENT_INGEST_FAILED", message=str(exc), status_code=500)


@router.post("/agents/{agent_id}/heartbeat", dependencies=[Depends(verify_api_key)])
def agent_heartbeat(agent_id: str):
    """Record an agent heartbeat."""
    try:
        reg = agent_service.get_registry()
        ok = reg.heartbeat(agent_id)
        if not ok:
            return error_response(code="AGENT_NOT_FOUND", message=f"Agent {agent_id} not found", status_code=404)
        return success_response(data={"agent_id": agent_id, "status": "heartbeat_recorded"})
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)


@router.get("/snapshot", dependencies=[Depends(verify_api_key)])
def snapshot():
    """Full observability snapshot: registry + recent events."""
    try:
        return success_response(data=agent_service.snapshot())
    except RuntimeError as exc:
        return error_response(code="AGENT_SERVICE_NOT_READY", message=str(exc), status_code=503)
