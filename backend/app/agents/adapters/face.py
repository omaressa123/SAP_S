"""Face verification adapter — wraps the existing AI/face_reco microservice.

The face_reco service (port 8001) provides DeepFace + FAISS face recognition
with endpoints /verify, /enroll, /security, /boarding. This adapter calls the
/verify endpoint with an image file, or accepts a pre-computed cosine
similarity score when inference has already been performed elsewhere.

It never treats face recognition as proof of visa validity or travel
eligibility — it returns a normalized detection + confidence, and the
Identity Agent applies explicit decision rules.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx

from .base import BaseModelAdapter, AdapterResult


class FaceVerificationAdapter(BaseModelAdapter):
    """Adapter for the face_recognition AI module (AI/face_reco, :8001)."""

    def __init__(self, service_url: Optional[str] = None, timeout: float = 15.0):
        super().__init__(model_id="face_recognition", service_url=service_url, timeout=timeout)
        self.match_threshold = 0.6

    async def infer(self, payload: Dict[str, Any]) -> AdapterResult:
        """Run face verification.

        Accepts either:
          - image_path: path to an image file (sent to face_reco /verify)
          - cosine_similarity: pre-computed similarity score (0-1)
          - match_threshold: override threshold (default 0.6)
        """
        if not self.validate_input(payload):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="Invalid input payload",
                requires_human_review=True,
            )

        image_path = payload.get("image_path")
        cosine_similarity = payload.get("cosine_similarity")
        threshold = payload.get("match_threshold", self.match_threshold)
        camera_id = payload.get("camera_id", "agent-camera")

        # Case 1: pre-computed similarity — no new inference needed
        if cosine_similarity is not None:
            try:
                sim = float(cosine_similarity)
            except (TypeError, ValueError):
                return AdapterResult(
                    success=False,
                    model_id=self.model_id,
                    error="Invalid cosine_similarity value",
                )
            detection = "face_match" if sim >= threshold else "face_no_match"
            verified_event = "verified" if sim >= threshold else "failed"
            return AdapterResult(
                success=True,
                model_id=self.model_id,
                model_version="deepface-arcface",
                detection=detection,
                confidence=sim,
                verified_event=verified_event,
                requires_human_review=sim < threshold,
                metadata={
                    "threshold": threshold,
                    "camera_id": camera_id,
                    "source": "precomputed_similarity",
                },
            )

        # Case 2: image path — call face_reco /verify microservice
        if image_path:
            return await self._infer_via_service(image_path, camera_id)

        return AdapterResult(
            success=False,
            model_id=self.model_id,
            error="No image_path or cosine_similarity provided",
            requires_human_review=True,
        )

    async def _infer_via_service(self, image_path: str, camera_id: str) -> AdapterResult:
        if not self.service_url:
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error="face_reco service URL not configured",
                service_unavailable=True,
                requires_human_review=True,
            )

        try:
            with open(image_path, "rb") as f:
                files = {"image": (image_path, f, "image/jpeg")}
                data = {"camera_id": camera_id}
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    r = await client.post(
                        self.service_url.rstrip("/") + "/verify",
                        files=files,
                        data=data,
                    )
                    if r.status_code >= 400:
                        return AdapterResult(
                            success=False,
                            model_id=self.model_id,
                            error=f"face_reco service error: {r.text[:300]}",
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
                error=f"face_reco service unavailable: {str(exc)[:300]}",
                service_unavailable=True,
                requires_human_review=True,
            )

        # Normalize face_reco VerifyResponse into AdapterResult
        verification_result = result.get("result", "no_match")
        similarity = result.get("similarity")
        threshold = result.get("threshold", self.match_threshold)
        verification_id = result.get("verification_id")

        detection = verification_result
        if verification_result == "match":
            verified_event = "verified"
        elif verification_result in ("no_match", "gate_denied", "flight_mismatch"):
            verified_event = "failed"
        else:
            verified_event = "review"

        return AdapterResult(
            success=True,
            model_id=self.model_id,
            model_version="deepface-arcface",
            detection=detection,
            confidence=float(similarity) if similarity is not None else None,
            verified_event=verified_event,
            requires_human_review=verification_result not in ("match", "gate_open"),
            metadata={
                "threshold": threshold,
                "camera_id": camera_id,
                "verification_id": verification_id,
                "service_result": result,
            },
        )

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "image_path" in payload or "cosine_similarity" in payload
