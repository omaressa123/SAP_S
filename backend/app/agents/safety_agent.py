"""Safety Agent — integrates fire, smoke, fall, and restricted-area detection.

Responsibilities:
  - Receive model and sensor events (smoke, fire, fall, restricted area,
    unattended bag, overcrowding, IoT telemetry)
  - Validate event structure and source
  - Track event timestamps and locations
  - Correlate related detections when reliable identifiers are available
  - Classify event severity using explicit rules
  - Generate alerts and record incidents (emergency_event, monitoring_alert)
  - Update Digital Twin state via event publisher
  - Trigger approved simulation workflows
  - Handle duplicate detections and uncertain results

Safety boundaries:
  - A model detection is a candidate event, NOT a confirmed emergency.
  - Does NOT trigger real emergency systems without authorized integrations.
  - All safety events require human review before escalation.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime

from ..database import SessionLocal
from ..models.admin_cameras import EmergencyEvent, MonitoringAlert
from ..models.devices import Equipment
from .base import AgentInterface, AgentStatus, AgentCapability, AgentResult
from .adapters.safety import SafetyAdapter, SEVERITY_MAP


class SafetyAgent(AgentInterface):
    """Agent for airport safety monitoring and incident response."""

    def __init__(
        self,
        smoke_fire_url: Optional[str] = None,
        fall_detection_url: Optional[str] = None,
    ):
        super().__init__(
            agent_id="safety_agent",
            name="Safety Monitoring Agent",
            description="Monitors fire, smoke, fall, and restricted-area detections "
                        "and coordinates safety incident response.",
        )
        self.safety_adapter = SafetyAdapter(
            smoke_fire_url=smoke_fire_url,
            fall_detection_url=fall_detection_url,
        )
        self.register_capability(AgentCapability(
            name="assess_safety",
            description="Evaluate safety detection events and classify severity",
            input_schema={
                "type": "object",
                "properties": {
                    "event_type": {"type": "string"},
                    "event_data": {"type": "object"},
                    "zone_id": {"type": "integer"},
                    "camera_id": {"type": "integer"},
                    "image_path": {"type": "string"},
                    "video_path": {"type": "string"},
                },
                "required": ["event_type"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "event_type": {"type": "string"},
                    "severity": {"type": "string"},
                    "verified_event": {"type": "string"},
                    "requires_human_review": {"type": "boolean"},
                },
            },
            requires_human_review=True,
            timeout_seconds=300,
        ))
        self.register_handler("smoke_detected", self._handle_safety_event)
        self.register_handler("fire_detected", self._handle_safety_event)
        self.register_handler("fall_detected", self._handle_safety_event)
        self.register_handler("restricted_area", self._handle_safety_event)
        self.register_handler("unattended_bag", self._handle_safety_event)
        self.register_handler("overcrowding", self._handle_safety_event)
        self.register_handler("iot_telemetry", self._handle_safety_event)

    # ----- AgentInterface -----

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "event_type" in payload

    async def handle_event(self, event) -> AgentResult:
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    # ----- event handlers -----

    async def _handle_safety_event(self, payload: Dict[str, Any]) -> AgentResult:
        """Process a safety detection event."""
        event_type = payload["event_type"]
        zone_id = payload.get("zone_id")
        camera_id = payload.get("camera_id")
        image_path = payload.get("image_path")
        video_path = payload.get("video_path")

        # Build detection payload for adapter
        adapter_payload = {
            "event_type": event_type,
            "zone_id": zone_id,
            "camera_id": camera_id,
            "image_path": image_path,
            "video_path": video_path,
        }

        # Pass through any detection_data if already available
        if "detection_data" in payload:
            adapter_payload["detection_data"] = payload["detection_data"]

        # Run safety adapter
        adapter_result = await self.safety_adapter.execute_with_guard(
            event_type=event_type,
            payload=adapter_payload,
        )

        if not adapter_result.success:
            # Service unavailable — record as candidate event with low confidence
            return await self._record_candidate_event(
                event_type=event_type,
                severity=SEVERITY_MAP.get(event_type, "medium"),
                zone_id=zone_id,
                camera_id=camera_id,
                error=adapter_result.error,
                service_unavailable=adapter_result.service_unavailable,
            )

        # Classify severity via explicit rules
        severity = SEVERITY_MAP.get(event_type, "medium")
        confidence = adapter_result.confidence
        verified_event = adapter_result.verified_event or f"{event_type}_candidate"

        # A model detection alone is NOT a confirmed emergency
        requires_review = True  # all safety events require human review

        # Persist incident records
        db = SessionLocal()
        try:
            is_confirmed_fall = adapter_result.detection == "confirmed_fall"
            emergency = None
            if is_confirmed_fall:
                # Determine emergency event type
                if event_type in ("smoke_detected", "fire_detected"):
                    ee_type = "smoke_fire"
                elif event_type == "fall_detected":
                    ee_type = "fall"
                elif event_type == "unattended_bag":
                    ee_type = "suspicious_bag"
                elif event_type == "restricted_area":
                    ee_type = "security_breach"
                elif event_type == "overcrowding":
                    ee_type = "crowding"
                else:
                    ee_type = event_type

                emergency = EmergencyEvent(
                    event_type=ee_type,
                    zone_id=zone_id,
                    status="detected",
                    detected_time=datetime.utcnow(),
                )
                db.add(emergency)
                db.flush()

            # Monitoring alert is always recorded for traceability; only a
            # confirmed fall carries high severity and an emergency link.
            alert_severity = severity if is_confirmed_fall else "info"
            db.add(MonitoringAlert(
                camera_id=camera_id,
                zone_id=zone_id,
                behavior_type=event_type,
                severity=alert_severity,
                status="open",
                linked_emergency_event_id=emergency.event_id if emergency else None,
                timestamp=datetime.utcnow(),
            ))
            db.commit()

            # Update equipment health if camera is linked to equipment
            if camera_id:
                from ..models.admin_cameras import Camera
                cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
                if cam and cam.equipment_id:
                    equip = db.query(Equipment).filter(Equipment.equipment_id == cam.equipment_id).first()
                    if equip:
                        equip.last_health_check = datetime.utcnow()
                        db.add(equip)
            db.commit()

            return AgentResult(
                success=True,
                data={
                    "event_type": event_type,
                    "emergency_event_id": emergency.event_id,
                    "severity": severity,
                    "verified_event": verified_event,
                    "requires_human_review": requires_review,
                    "confidence": confidence,
                    "service_unavailable": adapter_result.service_unavailable,
                },
                confidence=confidence,
                requires_human_review=requires_review,
                metadata={
                    "zone_id": zone_id,
                    "camera_id": camera_id,
                    "adapter_result": adapter_result.to_dict(),
                },
            )
        finally:
            db.close()

    async def _record_candidate_event(
        self,
        event_type: str,
        severity: str,
        zone_id: Optional[int],
        camera_id: Optional[int],
        error: Optional[str],
        service_unavailable: bool,
    ) -> AgentResult:
        """Record a safety event when model inference is unavailable."""
        db = SessionLocal()
        try:
            ee_type = "smoke_fire" if event_type in ("smoke_detected", "fire_detected") else event_type
            emergency = EmergencyEvent(
                event_type=ee_type,
                zone_id=zone_id,
                status="detected",
                detected_time=datetime.utcnow(),
            )
            db.add(emergency)
            db.flush()

            db.add(MonitoringAlert(
                camera_id=camera_id,
                zone_id=zone_id,
                behavior_type=event_type,
                severity=severity,
                status="open",
                linked_emergency_event_id=emergency.event_id,
                timestamp=datetime.utcnow(),
            ))
            db.commit()

            return AgentResult(
                success=not service_unavailable,
                data={
                    "event_type": event_type,
                    "emergency_event_id": emergency.event_id,
                    "severity": severity,
                    "verified_event": f"{event_type}_candidate",
                    "requires_human_review": True,
                    "model_inference_unavailable": service_unavailable,
                    "error": error,
                },
                confidence=None,
                requires_human_review=True,
                service_unavailable=service_unavailable,
                metadata={"service_unavailable": service_unavailable},
            )
        finally:
            db.close()
