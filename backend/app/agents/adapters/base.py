"""Base model adapter — wraps an existing AI microservice or library.

Each adapter:
  1. Validates incoming data
  2. Calls the existing model or its existing API
  3. Normalizes actual output into a documented event schema
  4. Preserves model confidence and relevant metadata
  5. Distinguishes detection results from verified events / decisions
  6. Handles inference failures and invalid outputs
  7. Records execution metadata without storing sensitive images/PII

Adapters never retrain or replace models. If a model is unavailable, they
report the limitation honestly rather than fabricating results.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import asyncio
import httpx
import json


@dataclass
class AdapterResult:
    """Normalized output from a model adapter."""
    success: bool
    model_id: str
    model_version: Optional[str] = None
    detection: Optional[str] = None       # raw model detection label
    confidence: Optional[float] = None    # model-reported confidence (0-1)
    verified_event: Optional[str] = None  # operational decision after rules
    requires_human_review: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    service_unavailable: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "detection": self.detection,
            "confidence": self.confidence,
            "verified_event": self.verified_event,
            "requires_human_review": self.requires_human_review,
            "metadata": self.metadata,
            "error": self.error,
            "service_unavailable": self.service_unavailable,
        }


class BaseModelAdapter(ABC):
    """Abstract adapter for an existing AI model/service."""

    def __init__(self, model_id: str, service_url: Optional[str] = None, timeout: float = 10.0):
        self.model_id = model_id
        self.service_url = service_url
        self.timeout = timeout

    @abstractmethod
    async def infer(self, payload: Dict[str, Any]) -> AdapterResult:
        """Run inference against the existing model and return normalized result."""
        raise NotImplementedError

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        """Default validation — subclasses override with stricter rules."""
        return isinstance(payload, dict) and bool(payload)

    async def _call_service(self, path: str, json_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Call an existing AI microservice via httpx. Returns None if unavailable."""
        if not self.service_url:
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(self.service_url.rstrip("/") + path, json=json_payload)
                if r.status_code < 400:
                    return r.json()
                return {"service_error": r.text[:500], "status_code": r.status_code}
        except Exception as exc:
            return {"service_unavailable": str(exc)[:300]}

    # ----- execution wrapper (same interface as AgentInterface) -----

    async def execute_with_guard(
        self,
        event_type: str,
        payload: Dict[str, Any],
        timeout_seconds: Optional[int] = None,
    ) -> AdapterResult:
        """Execute inference with validation, timeout, and error handling."""
        if not self.validate_input(payload):
            return AdapterResult(
                success=False,
                model_id=self.model_id,
                error=f"Input validation failed for {self.model_id}",
                requires_human_review=True,
            )
        timeout = timeout_seconds or self.timeout
        try:
            result = await asyncio.wait_for(
                self.infer(payload),
                timeout=timeout,
            )
            if not isinstance(result, AdapterResult):
                result = AdapterResult(
                    success=True, model_id=self.model_id,
                    data=result if isinstance(result, dict) else {},
                )
            return result
        except asyncio.CancelledError:
            return AdapterResult(
                success=False, model_id=self.model_id,
                error="Execution cancelled", requires_human_review=True,
            )
        except Exception as exc:  # noqa: BLE001
            return AdapterResult(
                success=False, model_id=self.model_id,
                error=f"{type(exc).__name__}: {exc}", requires_human_review=True,
            )
