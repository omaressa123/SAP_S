"""Persistent Passenger Journey Saga endpoints.

Reuses existing authentication:
  - X-API-KEY for operational/observability endpoints.
  - JWT bearer (get_current_user) + require_role(['staff','admin']) for
    human review decisions (approve/reject), matching the project's RBAC.

All endpoints follow the existing success_response / error_response envelope.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Body, Query, Path

from ..utils.auth import verify_api_key, get_current_user, require_role
from ..utils.response_envelope import success_response, error_response
from ..utils.errors import AirportException
from ..agents.service import agent_service
from ..agents.saga import SagaWorkflowEngine, JOURNEY_STEPS, STEP_BY_NAME

router = APIRouter()


def _engine() -> SagaWorkflowEngine:
    try:
        svc = agent_service
        if not svc.initialized or svc.saga_engine is None:
            raise RuntimeError("Saga engine not initialized")
        return svc.saga_engine
    except RuntimeError as exc:
        raise AirportException(code="SAGA_ENGINE_NOT_READY", message=str(exc), status_code=503)


class JourneyStartRequest(Dict[str, Any]):
    pass


@router.post("/sagas/journey/start", dependencies=[Depends(verify_api_key)])
def start_journey(
    correlation_id: str = Body(..., embed=True),
    passenger_id: int = Body(..., embed=True),
    booking_id: Optional[int] = Body(None, embed=True),
    flight_id: Optional[int] = Body(None, embed=True),
    input_payload: Optional[Dict[str, Any]] = Body(None, embed=True),
):
    """Start (or resume idempotently) a passenger journey Saga."""
    engine = _engine()
    try:
        saga = engine.start_journey(
            correlation_id=correlation_id,
            passenger_id=passenger_id,
            booking_id=booking_id,
            flight_id=flight_id,
            input_payload=input_payload,
        )
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="SAGA_START_FAILED", message=str(exc), status_code=500)
    return success_response(data={"saga_id": saga.saga_id, "status": saga.status,
                                  "correlation_id": saga.correlation_id})


@router.get("/sagas/{saga_id}", dependencies=[Depends(verify_api_key)])
def get_saga(saga_id: str = Path(...)):
    engine = _engine()
    saga = engine.get_saga(saga_id)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND", message=f"Saga {saga_id} not found", status_code=404)
    return success_response(data=saga)


@router.get("/sagas", dependencies=[Depends(verify_api_key)])
def list_sagas(limit: int = Query(50, ge=1, le=500)):
    engine = _engine()
    return success_response(data=engine.list_sagas(limit=limit))


@router.get("/sagas/correlation/{correlation_id}", dependencies=[Depends(verify_api_key)])
def get_saga_by_correlation(correlation_id: str = Path(...)):
    engine = _engine()
    saga = engine.get_saga_by_correlation(correlation_id)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND",
                              message=f"No saga for correlation_id {correlation_id}", status_code=404)
    return success_response(data=saga)


@router.post("/sagas/{saga_id}/resume", dependencies=[Depends(verify_api_key)])
def resume_saga(saga_id: str = Path(...)):
    engine = _engine()
    saga = engine.resume_saga(saga_id)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND", message=f"Saga {saga_id} not found", status_code=404)
    return success_response(data={"saga_id": saga.saga_id, "status": saga.status})


@router.post("/sagas/{saga_id}/cancel", dependencies=[Depends(verify_api_key)])
def cancel_saga(saga_id: str = Path(...)):
    engine = _engine()
    saga = engine.cancel_saga(saga_id)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND", message=f"Saga {saga_id} not found", status_code=404)
    return success_response(data={"saga_id": saga.saga_id, "status": saga.status})


@router.post("/sagas/{saga_id}/steps/{step_name}/approve",
             dependencies=[Depends(require_role(["staff", "admin"]))])
def approve_step(
    saga_id: str = Path(...),
    step_name: str = Path(...),
    reason: Optional[str] = Body(None, embed=True),
):
    engine = _engine()
    if step_name not in STEP_BY_NAME:
        return error_response(code="INVALID_STEP", message=f"Unknown step {step_name}", status_code=400)
    user = get_current_user()
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    saga = engine.approve_step(saga_id, step_name, staff_id=staff_id or 0, reason=reason)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND", message=f"Saga {saga_id} not found", status_code=404)
    return success_response(data={"saga_id": saga.saga_id, "status": saga.status,
                                  "step": step_name, "decision": "approved"})


@router.post("/sagas/{saga_id}/steps/{step_name}/reject",
             dependencies=[Depends(require_role(["staff", "admin"]))])
def reject_step(
    saga_id: str = Path(...),
    step_name: str = Path(...),
    reason: Optional[str] = Body(None, embed=True),
):
    engine = _engine()
    if step_name not in STEP_BY_NAME:
        return error_response(code="INVALID_STEP", message=f"Unknown step {step_name}", status_code=400)
    user = get_current_user()
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    saga = engine.reject_step(saga_id, step_name, staff_id=staff_id or 0, reason=reason)
    if not saga:
        return error_response(code="SAGA_NOT_FOUND", message=f"Saga {saga_id} not found", status_code=404)
    return success_response(data={"saga_id": saga.saga_id, "status": saga.status,
                                  "step": step_name, "decision": "rejected"})


@router.get("/sagas/steps", dependencies=[Depends(verify_api_key)])
def list_journey_steps():
    """Document the fixed, ordered journey steps and their compensation actions."""
    return success_response(data={
        "steps": [
            {
                "step_index": s["step_index"],
                "name": s["name"],
                "agent_id": s["agent_id"],
                "capability": s["capability"],
                "compensation": s["compensation"],
            }
            for s in JOURNEY_STEPS
        ],
        "statuses": ["initiated", "running", "completed", "failed", "cancelled",
                     "compensated", "human_review_required"],
        "step_statuses": ["pending", "running", "completed", "failed", "skipped",
                          "needs_review", "compensated"],
    })
