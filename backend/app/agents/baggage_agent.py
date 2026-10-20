"""Baggage Agent — integrates existing baggage tracking and X-ray detection.

Responsibilities:
  - Track baggage identifiers and status (bag, bag_checkpoint_log)
  - Receive screening results from BaggageThreatAdapter
  - Associate results with baggage only when the association is reliable
  - Apply explicit screening rules (SAFE / MANUAL_REVIEW)
  - Maintain baggage workflow state
  - Record suspicious events (detected_item, emergency_event, monitoring_alert)
  - Notify the authorized security workflow
  - Update backend state and publish Digital Twin events

Safety boundaries:
  - Does NOT directly control real baggage equipment.
  - Does NOT make unapproved real-world security decisions.
  - Suspicious bags are held for review; no automatic disposal.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import date, datetime

from ..database import SessionLocal
from ..models.check_in import Bag, CheckInRecord, BagCheckpointLog
from ..models.baggage_security_screening import BaggageInspection, DetectedItem
from ..models.admin_cameras import EmergencyEvent as MEmergencyEvent
from ..models.admin_cameras import MonitoringAlert as MMonitoringAlert
from .base import AgentInterface, AgentStatus, AgentCapability, AgentResult
from .adapters.baggage import BaggageThreatAdapter


class BaggageAgent(AgentInterface):
    """Agent for baggage screening and tracking across the passenger journey."""

    def __init__(self, backend_url: Optional[str] = None):
        super().__init__(
            agent_id="baggage_agent",
            name="Baggage Screening Agent",
            description="Tracks baggage, evaluates X-ray screening results, and "
                        "maintains baggage workflow state.",
        )
        self.threat_adapter = BaggageThreatAdapter(backend_url=backend_url)
        self.register_capability(AgentCapability(
            name="screen_baggage",
            description="Evaluate baggage X-ray results and update baggage state",
            input_schema={
                "type": "object",
                "properties": {
                    "bag_id": {"type": "integer"},
                    "image_path": {"type": "string"},
                    "detections": {"type": "array"},
                    "equipment_id": {"type": "integer"},
                    "ai_model_version": {"type": "string"},
                    "checkpoint_type": {"type": "string"},
                },
                "required": ["bag_id"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "bag_id": {"type": "integer"},
                    "screening_result": {"type": "string"},
                    "requires_manual_review": {"type": "boolean"},
                },
            },
            requires_human_review=False,
            timeout_seconds=300,
        ))
        self.register_capability(AgentCapability(
            name="track_baggage",
            description="Update baggage location/status at a checkpoint",
            input_schema={
                "type": "object",
                "properties": {
                    "bag_id": {"type": "integer"},
                    "checkpoint_type": {"type": "string"},
                    "location": {"type": "string"},
                    "equipment_id": {"type": "integer"},
                },
                "required": ["bag_id", "checkpoint_type"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "bag_id": {"type": "integer"},
                    "current_status": {"type": "string"},
                    "current_location": {"type": "string"},
                },
            },
            requires_human_review=False,
            timeout_seconds=300,
        ))
        self.register_handler("baggage_scan", self._handle_baggage_scan)
        self.register_handler("baggage_tracking", self._handle_baggage_tracking)

    # ----- AgentInterface -----

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "bag_id" in payload

    async def handle_event(self, event) -> AgentResult:
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    # ----- event handlers -----

    async def _handle_baggage_scan(self, payload: Dict[str, Any]) -> AgentResult:
        """Evaluate X-ray screening results for a bag."""
        bag_id = payload["bag_id"]
        image_path = payload.get("image_path")
        equipment_id = payload.get("equipment_id")
        detections = payload.get("detections", [])
        ai_model_version = payload.get("ai_model_version", "btd-yolo11")
        checkpoint_type = payload.get("checkpoint_type", "security_scan")

        db = SessionLocal()
        try:
            # Reliable association: bag must exist
            bag = db.query(Bag).filter(Bag.bag_id == bag_id).first()
            if not bag:
                return AgentResult(
                    success=False,
                    error=f"Bag {bag_id} not found — cannot associate screening result",
                    requires_human_review=True,
                )

            # Run threat detection adapter (real inference if image_path given)
            threat_result = await self.threat_adapter.execute_with_guard(
                event_type="baggage_scan",
                payload={
                    "bag_id": bag_id,
                    "image_path": image_path,
                    "detections": detections,
                    "equipment_id": equipment_id,
                    "ai_model_version": ai_model_version,
                    "checkpoint_type": checkpoint_type,
                },
            )

            if not threat_result.success:
                return AgentResult(
                    success=False,
                    error=threat_result.error or "Threat evaluation failed",
                    requires_human_review=True,
                    service_unavailable=threat_result.service_unavailable,
                )

            screening_result = threat_result.detection  # SAFE / MANUAL_REVIEW
            threat_found = threat_result.metadata.get("threat_found", False)
            normalized_detections = threat_result.metadata.get("detections", [])

            # Persist inspection row
            inspection = BaggageInspection(
                bag_id=bag_id,
                equipment_id=equipment_id,
                scan_time=datetime.utcnow(),
                ai_model_version=ai_model_version,
                result=screening_result,
            )
            db.add(inspection)
            db.flush()

            # Persist detected items
            for d in normalized_detections:
                db.add(DetectedItem(
                    inspection_id=inspection.inspection_id,
                    item_type=d["item_type"],
                    confidence_score=d["confidence"],
                ))

            # Update bag status
            if threat_found:
                bag.current_status = "stationary"  # hold for review
                # Create emergency event for suspicious bag
                db.add(MEmergencyEvent(
                    event_type="suspicious_bag",
                    zone_id=None,
                    status="detected",
                    detected_time=datetime.utcnow(),
                ))
                db.add(MMonitoringAlert(
                    behavior_type="unattended_bag",
                    severity="high",
                    status="open",
                    timestamp=datetime.utcnow(),
                ))
            else:
                bag.current_status = "moving"

            db.commit()

            # Record checkpoint log
            db.add(BagCheckpointLog(
                bag_id=bag_id,
                checkpoint_type=checkpoint_type,
                equipment_id=equipment_id,
                location=bag.current_location,
                timestamp=datetime.utcnow(),
            ))
            db.commit()

            requires_review = threat_result.requires_human_review

            return AgentResult(
                success=True,
                data={
                    "bag_id": bag_id,
                    "screening_result": screening_result,
                    "inspection_id": inspection.inspection_id,
                    "requires_manual_review": requires_review,
                    "threat_found": threat_found,
                    "detections": normalized_detections,
                },
                confidence=threat_result.confidence,
                requires_human_review=requires_review,
                metadata={
                    "bag_id": bag_id,
                    "current_status": bag.current_status,
                    "adapter_result": threat_result.to_dict(),
                },
            )
        finally:
            db.close()

    async def _handle_baggage_tracking(self, payload: Dict[str, Any]) -> AgentResult:
        """Update baggage location/status at a checkpoint."""
        bag_id = payload["bag_id"]
        checkpoint_type = payload["checkpoint_type"]
        location = payload.get("location")
        equipment_id = payload.get("equipment_id")

        db = SessionLocal()
        try:
            bag = db.query(Bag).filter(Bag.bag_id == bag_id).first()
            if not bag:
                return AgentResult(
                    success=False,
                    error=f"Bag {bag_id} not found",
                    requires_human_review=True,
                )

            bag.current_location = location or bag.current_location
            bag.current_status = checkpoint_type  # e.g. checkin, security_scan, conveyor, loaded_on_aircraft
            db.add(BagCheckpointLog(
                bag_id=bag_id,
                checkpoint_type=checkpoint_type,
                equipment_id=equipment_id,
                location=location,
                timestamp=datetime.utcnow(),
            ))
            db.commit()

            return AgentResult(
                success=True,
                data={
                    "bag_id": bag_id,
                    "current_status": bag.current_status,
                    "current_location": bag.current_location,
                },
                confidence=1.0,
                requires_human_review=False,
                metadata={"bag_id": bag_id},
            )
        finally:
            db.close()
