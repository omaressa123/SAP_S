"""Safety detection adapter — wraps fire, smoke, fall, and restricted-area models.

Integrates three existing capabilities:

  1. Smoke & Fire (AI/smoke_fire_detection) — training pipeline; no running
     inference service found. Adapter reports service_unavailable honestly.
  2. Fall detection (AI/fulldetection, :8004) — raw HTTP server with
     POST /api/analyze (video upload) + GET /api/jobs/{id} polling.
  3. Unattended baggage / restricted-area / overcrowding
     (AI/Baggage_And_Person_Detector) — SharedDetector Python class;
     adapter accepts detection data from a prior frame analysis.

Each detection is normalized into: detection label, confidence, verified_event
(after explicit severity rules), and requires_human_review. A model detection
is never treated as a confirmed emergency — it is a candidate event requiring
agent-level validation.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx
import asyncio

from .base import BaseModelAdapter, AdapterResult

SEVERITY_MAP = {
    "smoke_fire": "critical",
    "fire": "critical",
    "fire_detected": "critical",
    "smoke": "critical",
    "smoke_detected": "critical",
    "fall": "high",
    "fall_detected": "high",
    "confirmed_fall": "high",
    "unattended_bag": "high",
    "restricted_area": "high",
    "overcrowding": "medium",
    "intrusion": "high",
}


class SafetyAdapter(BaseModelAdapter):
    """Adapter for safety detection models (smoke/fire, fall, unattended bag)."""

    def __init__(
        self,
        smoke_fire_url: Optional[str] = None,
        fall_detection_url: Optional[str] = None,
        timeout: float = 15.0,
    ):
        super().__init__(model_id="safety_detection", service_url=smoke_fire_url, timeout=timeout)
        self.fall_detection_url = fall_detection_url

    async def infer(self, payload: Dict[str, Any]) -> AdapterResult:
        """Evaluate a safety event.

        Accepts one of:
          - event_type + image_path/video_path: run inference via available service
          - event_type + detection_data: normalize pre-computed detection
          - event_type only: report that model inference is required

        Supported event_types: smoke_detected, fire_detected, fall_detected,
        restricted_area, unattended_bag, overcrowding, iot_telemetry.
        """
        if not self.validate_input(payload):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="Invalid input payload",
            )

        event_type = payload.get("event_type", "unknown")
        detection_data = payload.get("detection_data")
        image_path = payload.get("image_path")
        video_path = payload.get("video_path")
        zone_id = payload.get("zone_id")
        camera_id = payload.get("camera_id")

        # Case: pre-computed detection data — normalize without new inference
        if detection_data:
            return self._normalize_detection(event_type, detection_data, zone_id, camera_id)

        # Case: run inference via available service
        if event_type in ("smoke_detected", "fire_detected"):
            return await self._infer_smoke_fire(image_path, zone_id, camera_id)
        if event_type == "fall_detected":
            return await self._infer_fall(video_path, zone_id, camera_id)
        if event_type in ("restricted_area", "unattended_bag", "overcrowding"):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=(
                    f"{event_type} requires frame-level detection data. "
                    "Provide detection_data from SharedDetector analysis."
                ),
                requires_human_review=True,
            )

        return AdapterResult(
            success=False,
            model_id=self.model_id,
            error=f"Unsupported safety event type: {event_type}",
            requires_human_review=True,
        )

    def _normalize_detection(
        self,
        event_type: str,
        detection_data: Dict[str, Any],
        zone_id: Optional[int],
        camera_id: Optional[int],
    ) -> AdapterResult:
        """Normalize pre-computed detection data into AdapterResult."""
        confidence = float(detection_data.get("confidence", 0.0))
        raw_label = str(detection_data.get("label", event_type))
        severity = SEVERITY_MAP.get(event_type, "medium")

        # Explicit severity rules: a detection is a candidate, not a confirmed event
        verified_event = f"{event_type}_candidate"
        requires_review = True  # all model detections require human review

        return AdapterResult(
            success=True,
            model_id=self.model_id,
            model_version="existing-model",
            detection=raw_label,
            confidence=confidence,
            verified_event=verified_event,
            requires_human_review=requires_review,
            metadata={
                "event_type": event_type,
                "severity": severity,
                "zone_id": zone_id,
                "camera_id": camera_id,
                "source": "precomputed_detection",
                "raw_data": detection_data,
            },
        )

    async def _infer_smoke_fire(
        self,
        image_path: Optional[str],
        zone_id: Optional[int],
        camera_id: Optional[int],
    ) -> AdapterResult:
        """Attempt smoke/fire inference via :8003 service."""
        if not self.service_url:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="smoke_fire service URL not configured (training pipeline only)",
                service_unavailable=True,
                requires_human_review=True,
            )

        if not image_path:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="image_path required for smoke/fire inference",
                requires_human_review=True,
            )

        try:
            with open(image_path, "rb") as f:
                files = {"image": (image_path, f, "image/jpeg")}
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(
                        self.service_url.rstrip("/") + "/analyze",
                        files=files,
                    )
                    if r.status_code >= 400:
                        return AdapterResult(
                            success=False,
                            model_id=self.model_id,
                            error=f"smoke_fire service error: {r.text[:300]}",
                            service_unavailable=True,
                            requires_human_review=True,
                        )
                    result = r.json()
        except FileNotFoundError:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"Image file not found: {image_path}",
                requires_human_review=True,
            )
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"smoke_fire service unavailable: {str(exc)[:300]}",
                service_unavailable=True,
                requires_human_review=True,
            )

        # Normalize unknown smoke_fire response format
        detected = bool(result.get("detected", False))
        confidence = float(result.get("confidence", 0.0)) if result.get("confidence") is not None else None

        return AdapterResult(
            success=detected,
            model_id=self.model_id,
            detection="smoke_fire" if detected else "none",
            confidence=confidence,
            verified_event="smoke_fire_candidate" if detected else "no_event",
            requires_human_review=detected,
            metadata={
                "zone_id": zone_id,
                "camera_id": camera_id,
                "service_response": result,
                "source": "smoke_fire_service",
            },
        )

    async def _infer_fall(
        self,
        video_path: Optional[str],
        zone_id: Optional[int],
        camera_id: Optional[int],
    ) -> AdapterResult:
        """Attempt fall detection via :8004 fulldetection service."""
        if not self.fall_detection_url:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="fall_detection service URL not configured",
                service_unavailable=True,
                requires_human_review=True,
            )

        if not video_path:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="video_path required for fall detection",
                requires_human_review=True,
            )

        # Submit video for analysis (returns job_id), then poll
        try:
            with open(video_path, "rb") as f:
                files = {"video": (video_path, f, "video/mp4")}
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(
                        self.fall_detection_url.rstrip("/") + "/api/analyze",
                        files=files,
                    )
                    if r.status_code >= 400:
                        return AdapterResult(
                            success=False,
                            model_id=self.model_id,
                            error=f"fall_detection service error: {r.text[:300]}",
                            service_unavailable=True,
                            requires_human_review=True,
                        )
                    submit = r.json()
        except FileNotFoundError:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"Video file not found: {video_path}",
                requires_human_review=True,
            )
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"fall_detection service unavailable: {str(exc)[:300]}",
                service_unavailable=True,
                requires_human_review=True,
            )

        job_id = submit.get("job_id")
        if not job_id:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="fall_detection service did not return a job_id",
                service_unavailable=True,
                requires_human_review=True,
            )

        # Poll for result (bounded retries)
        for _attempt in range(10):
            await asyncio.sleep(2.0)
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.get(
                        self.fall_detection_url.rstrip("/") + f"/api/jobs/{job_id}",
                    )
                    if r.status_code < 400:
                        job = r.json()
                        if job.get("status") == "completed":
                            confirmed = job.get("confirmed_falls", 0) > 0
                            summary = job.get("summary", "")
                            events = job.get("events", [])
                            return AdapterResult(
                                # success = inference completed successfully,
                                # regardless of whether a fall was found.
                                success=True,
                                model_id=self.model_id,
                                detection="confirmed_fall" if confirmed else "no_fall",
                                confidence=None,  # RF model doesn't expose per-event confidence
                                verified_event="fall_candidate" if confirmed else "no_event",
                                # Only a confirmed fall needs human review; a clean
                                # negative does not create an emergency.
                                requires_human_review=confirmed,
                                metadata={
                                    "job_id": job_id,
                                    "summary": summary,
                                    "events": events,
                                    "zone_id": zone_id,
                                    "camera_id": camera_id,
                                    "source": "fall_detection_service",
                                },
                            )
            except Exception:  # noqa: BLE001
                continue

        return AdapterResult(
            success=False,
            model_id=self.model_id,
            error="fall_detection job timed out",
            service_unavailable=True,
            requires_human_review=True,
        )

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "event_type" in payload
