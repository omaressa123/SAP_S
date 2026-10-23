"""Disruption recovery planner endpoints (M2.8).

Endpoints:
  POST   /agents/disruption/plan          — generate a validated recovery proposal (X-API-KEY)
  GET    /agents/disruption/plan/{id}     — proposal detail (X-API-KEY)
  GET    /agents/disruption/plans         — list proposals (X-API-KEY)
  POST   /agents/disruption/plan/{id}/approve   — human approval (JWT staff/admin)
  POST   /agents/disruption/plan/{id}/execute   — execute approved actions (JWT staff/admin)
  POST   /agents/disruption/plan/{id}/reject    — reject a proposal (JWT staff/admin)

Generation, validation, approval and execution are separate. An LLM is used
only when DISRUPTION_LLM_BASE_URL / DISRUPTION_LLM_API_KEY are configured;
otherwise a deterministic heuristic fallback builds the plan. Model output is
never executed directly — every plan is validated against deterministic
business rules. Consequential actions require authorized human approval.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Body, Query, Path

from ..utils.auth import verify_api_key, get_current_user, require_role
from ..utils.response_envelope import success_response, error_response
from ..utils.errors import AirportException
from ..agents.service import agent_service

router = APIRouter()


def _planner():
    try:
        return agent_service.get_disruption_planner()
    except RuntimeError:
        return None


class PlanRequest(Dict[str, Any]):
    pass


@router.post("/disruption/plan", dependencies=[Depends(verify_api_key)])
def generate_plan(
    scenario_id: str = Body(..., embed=True),
    scenario_type: str = Body("weather", embed=True),
    severity: str = Body("medium", embed=True),
    root_cause: str = Body(..., embed=True),
    created_by: str = Body("system", embed=True),
):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    try:
        proposal = planner.generate_proposal(
            scenario_id=scenario_id, scenario_type=scenario_type,
            severity=severity, root_cause=root_cause, created_by=created_by,
        )
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="PLAN_GENERATION_FAILED", message=str(exc), status_code=500)
    return success_response(data=proposal)


@router.get("/disruption/plan/{proposal_id}", dependencies=[Depends(verify_api_key)])
def get_plan(proposal_id: str = Path(...)):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    proposal = planner.get_proposal(proposal_id)
    if not proposal:
        return error_response(code="PROPOSAL_NOT_FOUND", message=f"Proposal {proposal_id} not found", status_code=404)
    return success_response(data=proposal)


@router.get("/disruption/plans", dependencies=[Depends(verify_api_key)])
def list_plans(limit: int = Query(50, ge=1, le=500)):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    return success_response(data=planner.list_proposals(limit=limit))


@router.post("/disruption/plan/{proposal_id}/approve",
             dependencies=[Depends(require_role(["staff", "admin"]))])
def approve_plan(
    proposal_id: str = Path(...),
    reason: Optional[str] = Body(None, embed=True),
    user: dict = Depends(get_current_user),
):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    if not staff_id:
        return error_response(code="UNAUTHORIZED", message="staff_id not present in token", status_code=401)
    try:
        proposal = planner.approve_proposal(proposal_id, staff_id=staff_id, reason=reason)
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="PLAN_APPROVE_FAILED", message=str(exc), status_code=500)
    if proposal is None:
        return error_response(code="PROPOSAL_NOT_FOUND", message=f"Proposal {proposal_id} not found", status_code=404)
    if proposal["status"] != "approved":
        return error_response(code="PROPOSAL_NOT_APPROVABLE",
                              message=f"Proposal {proposal_id} is not in a validatable state", status_code=409)
    return success_response(data=proposal)


@router.post("/disruption/plan/{proposal_id}/execute",
             dependencies=[Depends(require_role(["staff", "admin"]))])
def execute_plan(
    proposal_id: str = Path(...),
    user: dict = Depends(get_current_user),
):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    if not staff_id:
        return error_response(code="UNAUTHORIZED", message="staff_id not present in token", status_code=401)
    proposal = planner.get_proposal(proposal_id)
    if not proposal:
        return error_response(code="PROPOSAL_NOT_FOUND", message=f"Proposal {proposal_id} not found", status_code=404)
    if proposal["status"] != "approved":
        return error_response(code="PROPOSAL_NOT_APPROVED",
                              message=f"Proposal {proposal_id} must be approved before execution", status_code=409)
    try:
        proposal = planner.execute_proposal(proposal_id)
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="PLAN_EXECUTE_FAILED", message=str(exc), status_code=500)
    if not proposal:
        return error_response(code="PROPOSAL_NOT_FOUND", message=f"Proposal {proposal_id} not found", status_code=404)
    return success_response(data=proposal)


@router.post("/disruption/plan/{proposal_id}/reject",
             dependencies=[Depends(require_role(["staff", "admin"]))])
def reject_plan(
    proposal_id: str = Path(...),
    reason: Optional[str] = Body(None, embed=True),
    user: dict = Depends(get_current_user),
):
    planner = _planner()
    if planner is None:
        return error_response(code="PLANNER_NOT_READY", message="Disruption planner not initialized", status_code=503)
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    if not staff_id:
        return error_response(code="UNAUTHORIZED", message="staff_id not present in token", status_code=401)
    try:
        proposal = planner.reject_proposal(proposal_id, staff_id=staff_id, reason=reason)
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="PLAN_REJECT_FAILED", message=str(exc), status_code=500)
    if proposal is None:
        return error_response(code="PROPOSAL_NOT_FOUND", message=f"Proposal {proposal_id} not found", status_code=404)
    return success_response(data=proposal)
