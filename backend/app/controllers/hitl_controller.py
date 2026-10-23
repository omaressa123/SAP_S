"""Human-in-the-Loop (HITL) review endpoints (M2.7).

Endpoints:
  GET    /agents/hitl/pending          — list pending reviews (staff/admin)
  GET    /agents/hitl/reviews          — list all reviews (staff/admin)
  GET    /agents/hitl/reviews/{id}     — review detail (staff/admin)
  POST   /agents/hitl/reviews          — create a review request (X-API-KEY)
  POST   /agents/hitl/reviews/{id}/decision — submit approve/reject (JWT staff/admin)
  POST   /agents/hitl/expire           — expire overdue reviews (X-API-KEY)

All mutation endpoints persist the decision + audit record before any
downstream workflow action is triggered. Decisions require a reason for
sensitive overrides and reject duplicate/unauthorized/conflicting decisions.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Body, Query, Path

from ..utils.auth import verify_api_key, get_current_user, require_role
from ..utils.response_envelope import success_response, error_response
from ..utils.errors import AirportException
from ..agents.service import agent_service

router = APIRouter()


def _hitl():
    try:
        return agent_service.get_hitl_manager()
    except RuntimeError:
        return None


@router.get("/hitl/pending", dependencies=[Depends(require_role(["staff", "admin"]))])
def list_pending_reviews():
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    hitl.expire_reviews()  # surface any overdue reviews as escalated first
    return success_response(data=hitl.list_pending())


@router.get("/hitl/reviews", dependencies=[Depends(require_role(["staff", "admin"]))])
def list_reviews(limit: int = Query(50, ge=1, le=500)):
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    return success_response(data=hitl.list_all(limit=limit))


@router.get("/hitl/reviews/{review_id}", dependencies=[Depends(require_role(["staff", "admin"]))])
def get_review(review_id: str = Path(...)):
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    review = hitl.get_review(review_id)
    if not review:
        return error_response(code="REVIEW_NOT_FOUND", message=f"Review {review_id} not found", status_code=404)
    return success_response(data=review)


class ReviewCreateRequest(Dict[str, Any]):
    pass


@router.post("/hitl/reviews", dependencies=[Depends(verify_api_key)])
def create_review(
    correlation_id: str = Body(..., embed=True),
    step_name: str = Body(..., embed=True),
    agent_id: str = Body(..., embed=True),
    evidence: Optional[Dict[str, Any]] = Body(None, embed=True),
    confidence: Optional[float] = Body(None, embed=True),
    requested_reason: Optional[str] = Body(None, embed=True),
    saga_id: Optional[str] = Body(None, embed=True),
    event_id: Optional[str] = Body(None, embed=True),
    ttl_seconds: int = Body(900, embed=True),
):
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    try:
        review = hitl.create_review(
            correlation_id=correlation_id, step_name=step_name, agent_id=agent_id,
            evidence=evidence, confidence=confidence, requested_reason=requested_reason,
            saga_id=saga_id, event_id=event_id, ttl_seconds=ttl_seconds,
        )
    except Exception as exc:  # noqa: BLE001
        return error_response(code="REVIEW_CREATE_FAILED", message=str(exc), status_code=500)
    return success_response(data=hitl._serialize(review))


class ReviewDecisionRequest(Dict[str, Any]):
    pass


@router.post(
    "/hitl/reviews/{review_id}/decision",
    dependencies=[Depends(require_role(["staff", "admin"]))],
)
def submit_decision(
    review_id: str = Path(...),
    decision: str = Body(..., embed=True),
    reason: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
):
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    staff_id = int(user.get("staff_id", 0)) if user.get("staff_id") else None
    if not staff_id:
        return error_response(code="UNAUTHORIZED", message="staff_id not present in token", status_code=401)
    try:
        result = hitl.submit_decision(review_id, decision=decision, staff_id=staff_id, reason=reason)
    except ValueError as exc:
        return error_response(code="INVALID_DECISION", message=str(exc), status_code=400)
    except AirportException:
        raise
    except Exception as exc:  # noqa: BLE001
        return error_response(code="REVIEW_DECISION_FAILED", message=str(exc), status_code=500)
    if result is None:
        return error_response(code="REVIEW_NOT_FOUND_OR_UNAUTHORIZED",
                              message=f"Review {review_id} not found, already decided, or unauthorized", status_code=404)
    return success_response(data=result)


@router.post("/hitl/expire", dependencies=[Depends(verify_api_key)])
def expire_reviews():
    hitl = _hitl()
    if hitl is None:
        return error_response(code="HITL_NOT_READY", message="HITL manager not initialized", status_code=503)
    escalated = hitl.expire_reviews()
    return success_response(data={"escalated": escalated})
