"""Identity Agent — coordinates existing passport and face-verification components.

Workflow:
  Passport Input → OCR/MRZ Extraction → Document Data Validation →
  Face Verification → Evaluate Explicit Decision Rules → Verified / Retry / Review

Safety boundaries:
  - Face recognition is NOT proof of visa validity or travel eligibility.
  - Inconsistent or failed verification routes to a safe review workflow.
  - Final identity/immigration decisions always require human review when
    confidence is below threshold or data is inconsistent.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import json

from ..database import SessionLocal
from ..models.identity import Passenger, TravelDocument, FaceEnrollment, FaceVerificationLog
from ..models.admin_cameras import EmergencyEvent as MEmergencyEvent
from ..models.admin_cameras import MonitoringAlert as MMonitoringAlert
from ..models.flights import Booking
from .base import AgentInterface, AgentStatus, AgentCapability, AgentResult
from .adapters.face import FaceVerificationAdapter


class IdentityAgent(AgentInterface):
    """Agent for passenger identity verification at check-in, security, boarding."""

    def __init__(self, face_service_url: Optional[str] = None):
        super().__init__(
            agent_id="identity_agent",
            name="Identity Verification Agent",
            description="Coordinates passport/MRZ validation and face verification "
                        "for the passenger journey.",
        )
        self.face_adapter = FaceVerificationAdapter(service_url=face_service_url)
        self.register_capability(AgentCapability(
            name="verify_identity",
            description="Verify passenger identity via passport data + face match",
            input_schema={
                "type": "object",
                "properties": {
                    "passenger_id": {"type": "integer"},
                    "passport_number": {"type": "string"},
                    "cosine_similarity": {"type": "number"},
                    "image_path": {"type": "string"},
                    "checkpoint_type": {"type": "string"},
                    "match_threshold": {"type": "number"},
                },
                "required": [],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "decision": {"type": "string"},
                    "confidence": {"type": "number"},
                    "requires_human_review": {"type": "boolean"},
                },
            },
            requires_human_review=False,
            timeout_seconds=300,
        ))
        self.register_handler("face_verify", self._handle_face_verify)
        self.register_handler("passport_scan", self._handle_passport_scan)

    # ----- AgentInterface -----

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        # Must have at least a passenger_id or passport_number
        return "passenger_id" in payload or "passport_number" in payload

    async def handle_event(self, event) -> AgentResult:
        """Dispatch to the appropriate handler based on event type."""
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    # ----- event handlers -----

    async def _handle_face_verify(self, payload: Dict[str, Any]) -> AgentResult:
        """Full identity verification workflow."""
        passenger_id = payload.get("passenger_id")
        checkpoint_type = payload.get("checkpoint_type", "security_gate")
        threshold = float(payload.get("match_threshold", 0.6))

        # Step 1: Load passenger + document + enrollment from DB
        db = SessionLocal()
        try:
            passenger = db.query(Passenger).filter(Passenger.passenger_id == passenger_id).first() if passenger_id else None
            if not passenger:
                return AgentResult(
                    success=False,
                    error=f"Passenger {passenger_id} not found",
                    requires_human_review=True,
                )

            doc = db.query(TravelDocument).filter(TravelDocument.passenger_id == passenger_id).first()
            enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.passenger_id == passenger_id).first()

            # Step 2: Document data validation (explicit rules)
            doc_valid = self._validate_document(doc) if doc else False
            if not doc_valid:
                return AgentResult(
                    success=False,
                    data={"decision": "review", "reason": "invalid_or_missing_travel_document"},
                    confidence=0.0,
                    requires_human_review=True,
                )

            # Step 3: Face verification via adapter
            face_result = await self.face_adapter.execute_with_guard(
                event_type="face_verify",
                payload={
                    "cosine_similarity": payload.get("cosine_similarity"),
                    "image_path": payload.get("image_path"),
                    "camera_id": payload.get("equipment_id", "identity-agent"),
                    "match_threshold": threshold,
                },
            )

            if not face_result.success:
                return AgentResult(
                    success=False,
                    data={"decision": "retry", "reason": face_result.error},
                    confidence=face_result.confidence,
                    requires_human_review=True,
                )

            # Step 4: Apply explicit decision rules
            similarity = face_result.confidence or 0.0
            face_verified = face_result.verified_event == "verified"

            decision = self._evaluate_identity_rules(
                doc_valid=doc_valid,
                face_verified=face_verified,
                similarity=similarity,
                threshold=threshold,
                enrollment_exists=enrollment is not None,
                biometric_consent=passenger.biometric_consent,
            )

            # Step 5: Persist verification log
            self._persist_verification_log(
                db, passenger_id, enrollment.enrollment_id if enrollment else None,
                payload.get("equipment_id"), checkpoint_type,
                similarity, threshold, decision,
            )

            return AgentResult(
                success=True,
                data={
                    "decision": decision,
                    "confidence": similarity,
                    "document_valid": doc_valid,
                    "face_verified": face_verified,
                    "requires_human_review": decision == "review",
                    "face_result": face_result.to_dict(),
                },
                confidence=similarity,
                requires_human_review=decision == "review",
                metadata={
                    "passenger_id": passenger_id,
                    "checkpoint_type": checkpoint_type,
                    "threshold": threshold,
                },
            )
        finally:
            db.close()

    async def _handle_passport_scan(self, payload: Dict[str, Any]) -> AgentResult:
        """Handle a passport scan event (MRZ data already extracted)."""
        passport_number = payload.get("passport_number")
        mrz_data = payload.get("mrz_data", {})

        db = SessionLocal()
        try:
            doc = db.query(TravelDocument).filter(TravelDocument.document_number == passport_number).first()
            if not doc:
                return AgentResult(
                    success=False,
                    data={"decision": "review", "reason": "passport_not_enrolled"},
                    confidence=0.0,
                    requires_human_review=True,
                )

            passenger = db.query(Passenger).filter(Passenger.passenger_id == doc.passenger_id).first()
            if not passenger:
                return AgentResult(
                    success=False,
                    error="Passenger record not found for document",
                    requires_human_review=True,
                )

            # Validate document against MRZ data
            doc_valid = self._validate_document(doc, mrz_data)

            return AgentResult(
                success=True,
                data={
                    "decision": "verified" if doc_valid else "review",
                    "passenger_id": passenger.passenger_id,
                    "document_valid": doc_valid,
                    "requires_human_review": not doc_valid,
                },
                confidence=1.0 if doc_valid else 0.0,
                requires_human_review=not doc_valid,
                metadata={"passport_number": passport_number},
            )
        finally:
            db.close()

    # ----- decision rules -----

    def _evaluate_identity_rules(
        self,
        doc_valid: bool,
        face_verified: bool,
        similarity: float,
        threshold: float,
        enrollment_exists: bool,
        biometric_consent: bool,
    ) -> str:
        """Apply explicit decision rules. Returns: verified / retry / review."""
        # No biometric consent → cannot use face for identity → review
        if not biometric_consent:
            return "review"

        # No enrollment → cannot verify face → review
        if not enrollment_exists:
            return "review"

        # Document invalid → review
        if not doc_valid:
            return "review"

        # Face not verified → retry
        if not face_verified:
            return "retry"

        # Face verified but low confidence → review
        if similarity < threshold:
            return "review"

        # All checks passed → verified
        return "verified"

    def _validate_document(
        self,
        doc,
        mrz_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Explicit document validation rules."""
        if not doc:
            return False
        # Document must have a number and not be expired
        if not doc.document_number:
            return False
        if doc.expiry_date:
            from datetime import date
            if doc.expiry_date < date.today():
                return False
        # If MRZ data provided, cross-check
        if mrz_data:
            if mrz_data.get("passport_number") and mrz_data["passport_number"] != doc.document_number:
                return False
        return True

    # ----- persistence -----

    def _persist_verification_log(
        self,
        db: SessionLocal,
        passenger_id: int,
        enrollment_id: Optional[int],
        equipment_id: Optional[int],
        checkpoint_type: str,
        similarity: Optional[float],
        threshold: float,
        decision: str,
    ) -> None:
        from datetime import datetime
        status = "verified" if decision == "verified" else ("failed" if decision == "retry" else "flagged_for_staff")
        row = FaceVerificationLog(
            passenger_id=passenger_id,
            enrollment_id=enrollment_id,
            equipment_id=equipment_id,
            checkpoint_type=checkpoint_type,
            cosine_similarity=similarity,
            match_threshold=threshold,
            verification_status=status,
            timestamp=datetime.utcnow(),
        )
        db.add(row)
        db.commit()
