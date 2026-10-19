"""Baggage threat detection adapter — wraps the real BTD YOLO11 model.

Integrates the existing BTD module (AI/BTD, YOLO11 on ``best.pt``) through its
HTTP inference endpoint (``AI/BTD/inference_server.py``). No model is
retrained or replaced.

The BTD class labels (from ``classes.json`` / the checkpoint) are all
threat/contraband items:

    baton, bullet, gun, hammer, handcuffs, knife, lighter, pliers,
    powerbank, scissors, sprayer, wrench

Screening policy (explicit rules):
  - Any detection returned by the model  -> MANUAL_REVIEW (possible threat)
  - No detections                        -> SAFE
  - Inference/service failure            -> PROCESSING_ERROR (never SAFE)

A model detection is a candidate event requiring human review; it is never
treated as a calibrated probability or as proof of a threat by itself.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
import httpx

from ...config import settings
from .base import BaseModelAdapter, AdapterResult

# All BTD classes are threat/contraband items. Any detection at/above the
# model confidence threshold warrants manual review.
THREAT_CONFIDENCE_THRESHOLD = 0.5


class BaggageThreatAdapter(BaseModelAdapter):
    """Adapter for baggage threat detection (BTD YOLO11).

    Supports two input modes:
      1. ``image_path`` — upload the X-ray image to the BTD inference endpoint
         and run real YOLO11 inference.
      2. ``detections`` — use precomputed detection data (existing callers).
    """

    def __init__(
        self,
        service_url: Optional[str] = None,
        backend_url: Optional[str] = None,
        timeout: float = 15.0,
    ):
        super().__init__(
            model_id="baggage_threat_detection",
            service_url=service_url or settings.BTD_INFERENCE_URL,
            timeout=timeout,
        )
        self.backend_url = backend_url

    async def infer(self, payload: Dict[str, Any]) -> AdapterResult:
        """Evaluate baggage screening results.

        Accepts:
          - image_path: path to an X-ray image (calls BTD inference endpoint)
          - detections: list of {item_type, confidence} (precomputed)
          - bag_id, equipment_id, ai_model_version, checkpoint_type
        """
        if not self.validate_input(payload):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="Invalid input payload",
                requires_human_review=True,
            )

        image_path = payload.get("image_path")
        precomputed = payload.get("detections")
        bag_id = payload.get("bag_id")
        equipment_id = payload.get("equipment_id")
        ai_model_version = payload.get("ai_model_version", "btd-yolo11")
        checkpoint_type = payload.get("checkpoint_type", "security_scan")

        # Mode 1: real inference via the BTD HTTP endpoint
        if image_path:
            return await self._infer_via_endpoint(
                image_path=image_path,
                bag_id=bag_id,
                equipment_id=equipment_id,
                ai_model_version=ai_model_version,
                checkpoint_type=checkpoint_type,
            )

        # Mode 2: precomputed detections (existing callers)
        return self._evaluate_detections(
            detections=precomputed or [],
            bag_id=bag_id,
            equipment_id=equipment_id,
            ai_model_version=ai_model_version,
            checkpoint_type=checkpoint_type,
        )

    # ----- real inference path -----

    async def _infer_via_endpoint(
        self,
        image_path: str,
        bag_id: Optional[int],
        equipment_id: Optional[int],
        ai_model_version: str,
        checkpoint_type: str,
    ) -> AdapterResult:
        """Upload an X-ray image to the BTD inference endpoint and parse the
        actual model response."""
        if not self.service_url:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="BTD inference endpoint URL not configured (BTD_INFERENCE_URL)",
                service_unavailable=True,
                requires_human_review=True,
            )

        try:
            with open(image_path, "rb") as f:
                files = {"image": (image_path, f, "image/jpeg")}
                data = {"conf": 0.75, "iou": 0.45}
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(
                        self.service_url.rstrip("/") + "/analyze",
                        files=files,
                        data=data,
                    )
        except FileNotFoundError:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"Image file not found: {image_path}",
                requires_human_review=True,
            )
        except httpx.ConnectError as exc:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"BTD inference service unreachable: {exc}",
                service_unavailable=True,
                requires_human_review=True,
            )
        except httpx.TimeoutException as exc:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"BTD inference service timed out: {exc}",
                service_unavailable=True,
                requires_human_review=True,
            )
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"BTD inference request failed: {type(exc).__name__}: {exc}",
                service_unavailable=True,
                requires_human_review=True,
            )

        # HTTP-level errors are inference failures, not SAFE results.
        if r.status_code >= 400:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"BTD inference service error: HTTP {r.status_code} {r.text[:300]}",
                service_unavailable=True,
                requires_human_review=True,
            )

        try:
            result = r.json()
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"BTD inference service returned invalid JSON: {exc}",
                service_unavailable=True,
                requires_human_review=True,
            )

        detections = result.get("detections", [])
        if not isinstance(detections, list):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="BTD inference service returned malformed detections",
                service_unavailable=True,
                requires_human_review=True,
            )

        normalized = []
        for d in detections:
            item_type = str(d.get("item_type", "unknown"))[:30]
            try:
                confidence = float(d.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            normalized.append({"item_type": item_type, "confidence": confidence})

        return self._evaluate_detections(
            detections=normalized,
            bag_id=bag_id,
            equipment_id=equipment_id,
            ai_model_version=ai_model_version,
            checkpoint_type=checkpoint_type,
        )

    # ----- decision rules (shared by both modes) -----

    def _evaluate_detections(
        self,
        detections: List[Dict[str, Any]],
        bag_id: Optional[int],
        equipment_id: Optional[int],
        ai_model_version: str,
        checkpoint_type: str,
    ) -> AdapterResult:
        """Apply explicit screening rules to normalized detections.

        Returns an AdapterResult. A detection (any class, any confidence) is a
        candidate threat -> MANUAL_REVIEW. No detections -> SAFE.
        """
        threat_found = len(detections) > 0
        max_confidence = max((d["confidence"] for d in detections), default=None)

        if threat_found:
            result = "MANUAL_REVIEW"
            verified_event = "threat_detected"
            requires_review = True
        else:
            result = "SAFE"
            verified_event = "no_items_detected"
            requires_review = False

        # Note: the BaggageAgent persists the inspection / detected items to
        # the database directly, so no redundant backend call is needed here.

        return AdapterResult(
            success=True,
            model_id=self.model_id,
            model_version=ai_model_version,
            detection=result,
            confidence=max_confidence,
            verified_event=verified_event,
            requires_human_review=requires_review,
            metadata={
                "bag_id": bag_id,
                "equipment_id": equipment_id,
                "checkpoint_type": checkpoint_type,
                "detection_count": len(detections),
                "detections": detections,
                "threat_found": threat_found,
                "source": "btd_inference_endpoint",
            },
        )

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "image_path" in payload or "detections" in payload or "bag_id" in payload
