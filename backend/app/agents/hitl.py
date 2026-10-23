"""Human-in-the-Loop (HITL) review manager (M2.7).

Persistent human-review workflow integrated with the existing authentication
and agent systems.

Key guarantees:
  - Review requests are persisted to PostgreSQL (hitlreview) so they survive
    WebSocket disconnects and application restarts; no notification is ever
    the sole source of truth for a pending review.
  - A timeout never silently approves an uncertain identity or clears a
    possible security threat: expired reviews transition to an explicit
    ``escalated`` safe state.
  - Decisions are validated (duplicate, unauthorized, conflicting decisions
    are rejected) and persisted with audit records before downstream workflow
    actions are triggered.
  - Real staff/admin authorization via the existing JWT + role-based access
    control.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.hitl import HitlReview
from ..models.agents import DecisionAudit as MDecisionAudit
from ..models.staff import Staff
from .saga import SagaWorkflowEngine, StepStatus, SagaStatus


class HitlManager:
    """Manages persistent human-review requests and their decisions."""

    REVIEW_STATUSES = {"pending", "approved", "rejected", "expired", "escalated"}

    def __init__(
        self,
        saga_engine: SagaWorkflowEngine,
        session_factory: Callable[[], Session] = SessionLocal,
    ):
        self.saga_engine = saga_engine
        self._session_factory = session_factory
        # Subscribers notified when a review is created/resolved (for WS
        # push to the WorkflowMonitor). Notifications are best-effort; the
        # DB record is authoritative.
        self._subscribers: List[Callable[[Dict[str, Any]], None]] = []

    def subscribe(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        self._subscribers.append(callback)

    def _notify(self, payload: Dict[str, Any]) -> None:
        for cb in self._subscribers:
            try:
                cb(payload)
            except Exception:  # noqa: BLE001
                pass

    # ------------------------------------------------------------------ create

    def create_review(
        self,
        *,
        correlation_id: str,
        step_name: str,
        agent_id: str,
        evidence: Dict[str, Any],
        confidence: Optional[float] = None,
        requested_reason: Optional[str] = None,
        saga_id: Optional[str] = None,
        event_id: Optional[str] = None,
        ttl_seconds: int = 900,
    ) -> HitlReview:
        """Create a pending review request.

        Idempotent-ish: creates a new review per request; callers should
        check pending reviews for an existing correlation/step before
        creating duplicates.
        """
        review = HitlReview(
            review_id=f"hitl_{uuid.uuid4().hex[:12]}",
            saga_id=saga_id,
            step_name=step_name,
            agent_id=agent_id,
            event_id=event_id,
            correlation_id=correlation_id,
            status="pending",
            evidence=None if not evidence else __import__("json").dumps(evidence),
            confidence=confidence,
            requested_reason=requested_reason,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
        )
        db = self._session_factory()
        try:
            db.add(review)
            db.commit()
            db.refresh(review)
        finally:
            db.close()
        self._notify(self._serialize(review))
        return review

    # ------------------------------------------------------------------ queries

    def get_review(self, review_id: str) -> Optional[Dict[str, Any]]:
        db = self._session_factory()
        try:
            row = db.query(HitlReview).filter(HitlReview.review_id == review_id).first()
            return self._serialize(row) if row else None
        finally:
            db.close()

    def list_pending(self) -> List[Dict[str, Any]]:
        db = self._session_factory()
        try:
            rows = (
                db.query(HitlReview)
                .filter(HitlReview.status == "pending")
                .order_by(HitlReview.created_at.asc())
                .all()
            )
            return [self._serialize(r) for r in rows]
        finally:
            db.close()

    def list_all(self, limit: int = 50) -> List[Dict[str, Any]]:
        db = self._session_factory()
        try:
            rows = (
                db.query(HitlReview)
                .order_by(HitlReview.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._serialize(r) for r in rows]
        finally:
            db.close()

    # ------------------------------------------------------------------ expiry (safe escalation)

    def expire_reviews(self) -> List[str]:
        """Mark pending reviews past their expiry as expired -> escalated.

        An expired review is NOT approved; it is escalated to an explicit
        safe state so a human must intervene before any downstream action.
        Returns the list of review ids that were escalated.
        """
        now = datetime.now(timezone.utc)
        db = self._session_factory()
        try:
            rows = (
                db.query(HitlReview)
                .filter(HitlReview.status == "pending")
                .filter(HitlReview.expires_at < now)
                .all()
            )
            escalated: List[str] = []
            for row in rows:
                row.status = "escalated"
                row.updated_at = now
                db.add(row)
                escalated.append(row.review_id)
            if escalated:
                db.commit()
        finally:
            db.close()
        for rid in escalated:
            self._notify({"review_id": rid, "status": "escalated", "reason": "review_expired"})
        return escalated

    # ------------------------------------------------------------------ decision

    def submit_decision(
        self,
        review_id: str,
        *,
        decision: str,  # "approve" or "reject"
        staff_id: int,
        reason: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Record a human decision and resume/reject/compensate the workflow.

        - ``approve``: resumes the linked saga step (via SagaWorkflowEngine).
        - ``reject``: rejects the step and compensates.
        - Returns the updated review record, or None if not found / already
          decided (prevents duplicate & conflicting decisions).
        """
        if decision not in {"approve", "reject"}:
            raise ValueError("decision must be 'approve' or 'reject'")
        if not reason:
            raise ValueError("a review reason is required")

        db = self._session_factory()
        try:
            row = db.query(HitlReview).filter(HitlReview.review_id == review_id).first()
            if row is None:
                return None
            if row.status != "pending":
                # Already decided or expired/escalated: no conflicting decision.
                return None

            staff = db.query(Staff).filter(Staff.staff_id == staff_id).first()
            if staff is None or not staff.is_active:
                return None  # unauthorized

            row.status = "approved" if decision == "approve" else "rejected"
            row.decided_by = staff_id
            row.decided_at = datetime.now(timezone.utc)
            row.decision_reason = reason
            row.updated_at = datetime.now(timezone.utc)
            db.commit()
            review_serialized = self._serialize(row)
        finally:
            db.close()

        # Persist the decision to the audit log BEFORE triggering downstream
        # workflow actions, so the human override is always recorded.
        if row.saga_id:
            self._record_decision_audit(
                row.saga_id, row.step_name, row.agent_id, decision, reason, staff_id,
            )

        # Resume / reject / compensate the corresponding workflow.
        saga_status = None
        if decision == "approve":
            if row.saga_id and row.step_name:
                updated = self.saga_engine.approve_step(
                    row.saga_id, row.step_name, staff_id=staff_id, reason=reason,
                )
                saga_status = updated["status"] if isinstance(updated, dict) else None
            else:
                saga_status = None
        else:
            if row.saga_id and row.step_name:
                updated = self.saga_engine.reject_step(
                    row.saga_id, row.step_name, staff_id=staff_id, reason=reason,
                )
                saga_status = updated["status"] if isinstance(updated, dict) else None
            else:
                saga_status = None

        review_serialized["saga_status"] = saga_status
        self._notify({**review_serialized, "decision": decision})
        return review_serialized

    # ------------------------------------------------------------------ helpers

    def _record_decision_audit(
        self, saga_id: str, step_name: str, agent_id: str, decision: str,
        reason: Optional[str], staff_id: int,
    ) -> None:
        db = self._session_factory()
        try:
            step = None
            # Find the step id for this saga+step to link the audit record.
            try:
                steps = self.saga_engine.get_saga(saga_id).get("steps", [])  # type: ignore[union-attr]
                for s in steps:
                    if s["name"] == step_name:
                        step = s
                        break
            except Exception:  # noqa: BLE001
                step = None
            task_id = step["step_id"] if step else None
            row = MDecisionAudit(
                workflow_id=saga_id,
                task_id=task_id,
                agent_id=agent_id,
                decision="verified" if decision == "approve" else "rejected",
                rationale=f"human {decision}: {reason}",
                confidence=None,
                requires_human_review=True,
                human_reviewed_by=staff_id,
                human_reviewed_at=datetime.now(timezone.utc),
            )
            db.add(row)
            db.commit()
        finally:
            db.close()

    @staticmethod
    def _serialize(row: HitlReview) -> Dict[str, Any]:
        return {
            "review_id": row.review_id,
            "saga_id": row.saga_id,
            "step_name": row.step_name,
            "agent_id": row.agent_id,
            "event_id": row.event_id,
            "correlation_id": row.correlation_id,
            "status": row.status,
            "evidence": __import__("json").loads(row.evidence or "{}"),
            "confidence": float(row.confidence) if row.confidence is not None else None,
            "requested_reason": row.requested_reason,
            "decided_by": row.decided_by,
            "decided_at": row.decided_at.isoformat() if row.decided_at else None,
            "decision_reason": row.decision_reason,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "escalated_to": row.escalated_to,
        }
