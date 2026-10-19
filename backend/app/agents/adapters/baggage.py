"""Baggage threat detection adapter — wraps existing X-ray baggage screening.

The BTD module (AI/BTD, :8002) is a Gradio-based YOLO11 interface — it is
NOT a REST API and cannot be called directly via HTTP. This adapter instead:

  1. Accepts detection data already produced by a baggage scan (e.g. via the
     backend's /api/v1/ai/baggage/analyze endpoint which records
     BaggageInspection + DetectedItem rows), OR
  2. Reports that the BTD service is Gradio-only and not directly invocable.

It normalizes detection results into a consistent schema, preserves confidence
scores, and applies explicit screening rules (SAFE vs MANUAL_REVIEW) without
fabricating predictions.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx

from .base import BaseModelAdapter, AdapterResult

# Threat item types that trigger MANUAL_REVIEW per the schema CHECK constraint
THREAT_ITEM_TYPES = {"knife", "gun", "liquid", "power_bank", "battery", "aerosol"}


class BaggageThreatAdapter(BaseModelAdapter):
    """Adapter for baggage threat detection (BTD YOLO11)."""

    def __init__(
        self,
        service_url: Optional[str] = None,
        backend_url: Optional[str] = None,
        timeout: float = 15.0,
    ):
        super().__init__(model_id="baggage_threat_detection", service_url=service_url, timeout=timeout)
        self.backend_url = backend_url  # e.g. http://localhost:8000/api/v1/ai/baggage/analyze

    async def infer(self, payload: Dict[str, Any]) -> AdapterResult:
        """Evaluate baggage screening results.

        Accepts:
          - detections: list of {item_type, confidence} from a prior scan
          - bag_id: associated baggage identifier
          - equipment_id: scanner equipment id
          - ai_model_version: model version string
        """
        if not self.validate_input(payload):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="Invalid input payload",
            )

        detections = payload.get("detections", [])
        bag_id = payload.get("bag_id")
        equipment_id = payload.get("equipment_id")
        ai_model_version = payload.get("ai_model_version", "btd-yolo11")

        # Normalize detections
        normalized = []
        threat_found = False
        max_confidence = 0.0
        for d in detections:
            item_type = str(d.get("item_type", "unknown"))[:30]
            confidence = float(d.get("confidence", 0.0))
            max_confidence = max(max_confidence, confidence)
            if item_type in THREAT_ITEM_TYPES:
                threat_found = True
            normalized.append({"item_type": item_type, "confidence": confidence})

        # Apply explicit screening rules
        if threat_found:
            result = "MANUAL_REVIEW"
            verified_event = "threat_detected"
            requires_review = True
        elif len(normalized) > 0:
            result = "SAFE"  # non-threat items detected
            verified_event = "screened_safe"
            requires_review = False
        else:
            result = "SAFE"
            verified_event = "no_items_detected"
            requires_review = False

        # Optionally persist via backend ai_controller endpoint
        if self.backend_url and bag_id:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    await client.post(
                        self.backend_url,
                        json={
                            "bag_id": bag_id,
                            "equipment_id": equipment_id,
                            "ai_model_version": ai_model_version,
                            "detections": normalized,
                        },
                    )
            except Exception:  # noqa: BLE001
                # Backend persistence is best-effort; result is still valid
                pass

        return AdapterResult(
            success=True,
            model_id=self.model_id,
            model_version=ai_model_version,
            detection=result,
            confidence=max_confidence if normalized else None,
            verified_event=verified_event,
            requires_human_review=requires_review,
            metadata={
                "bag_id": bag_id,
                "equipment_id": equipment_id,
                "detection_count": len(normalized),
                "detections": normalized,
                "threat_found": threat_found,
                "source": "existing_scan_or_backend",
            },
        )

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "detections" in payload or "bag_id" in payload
