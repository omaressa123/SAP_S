"""Digital Twin event publisher.

Publishes agent state changes to the existing Digital Twin REST API
(airport-twin, port 8100) via the /api/twin/ingest and
/api/twin/assets/{code}/command endpoints. Reuses the existing twin
infrastructure — no new messaging layer is introduced.

The Digital Twin remains responsible for visualization; agents only publish
structured state changes. The twin is never the source of operational
decisions.

Twin delivery status is tracked separately from inference success: inference
may succeed while Twin delivery fails (network, auth, etc.). Expired or
invalid JWTs (401/403) are detected explicitly and never silently reported
as successful delivery.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx


class TwinDeliveryResult:
    """Outcome of a Twin publish attempt."""

    def __init__(
        self,
        delivered: bool = False,
        error: Optional[str] = None,
        auth_error: bool = False,
        status_code: Optional[int] = None,
    ):
        self.delivered = delivered
        self.error = error
        self.auth_error = auth_error
        self.status_code = status_code

    def to_dict(self) -> Dict[str, Any]:
        return {
            "delivered": self.delivered,
            "error": self.error,
            "auth_error": self.auth_error,
            "status_code": self.status_code,
        }


class TwinPublisher:
    """Publishes agent-driven state changes to the Digital Twin."""

    def __init__(
        self,
        twin_base_url: str = "http://localhost:8100",
        auth_token: Optional[str] = None,
        timeout: float = 10.0,
    ):
        self.twin_base_url = twin_base_url.rstrip("/")
        self.auth_token = auth_token
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def publish_state_change(
        self,
        entity_code: str,
        entity_type: str,
        status: str,
        payload: Dict[str, Any] | None = None,
    ) -> TwinDeliveryResult:
        """Publish a state change for a twin asset via /api/twin/ingest.

        Returns a TwinDeliveryResult. Delivery failure is non-fatal for the
        agent workflow — the twin is visualization-only.
        """
        reading = {
            "asset_id": entity_code,
            "asset_type": entity_type,
            "status": status,
            "payload": payload or {},
        }
        return await self._post_reading(reading)

    async def publish_agent_event(
        self,
        asset_code: str,
        event_type: str,
        payload: Dict[str, Any] | None = None,
    ) -> TwinDeliveryResult:
        """Publish an agent event as a twin asset event."""
        reading = {
            "asset_id": asset_code,
            "asset_type": "agent_event",
            "status": event_type,
            "payload": payload or {},
        }
        return await self._post_reading(reading)

    async def send_command(
        self,
        asset_code: str,
        command: str,
        params: Dict[str, Any] | None = None,
    ) -> TwinDeliveryResult:
        """Send a command to a twin asset (audited + WebSocket broadcast).

        Commands are simulated only — no real-world equipment control.
        """
        reading = {
            "command": command,
            "params": params or {},
        }
        return await self._post_command(asset_code, reading)

    async def _post_reading(
        self,
        reading: Dict[str, Any],
    ) -> TwinDeliveryResult:
        """POST a reading to /api/twin/ingest. Returns TwinDeliveryResult."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    f"{self.twin_base_url}/api/twin/ingest",
                    json=reading,
                    headers=self._headers(),
                )
                if r.status_code == 401 or r.status_code == 403:
                    return TwinDeliveryResult(
                        delivered=False,
                        error=f"Twin authentication failed (HTTP {r.status_code}): token expired or invalid",
                        auth_error=True,
                        status_code=r.status_code,
                    )
                return TwinDeliveryResult(
                    delivered=r.status_code < 400,
                    error=None if r.status_code < 400 else f"HTTP {r.status_code}: {r.text[:200]}",
                    auth_error=False,
                    status_code=r.status_code,
                )
        except httpx.ConnectError as exc:
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin unreachable: {exc}",
                auth_error=False,
            )
        except httpx.TimeoutException as exc:
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin request timed out: {exc}",
                auth_error=False,
            )
        except Exception as exc:  # noqa: BLE001
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin request failed: {type(exc).__name__}: {exc}",
                auth_error=False,
            )

    async def _post_command(
        self,
        asset_code: str,
        reading: Dict[str, Any],
    ) -> TwinDeliveryResult:
        """POST a command to /api/twin/assets/{code}/command."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    f"{self.twin_base_url}/api/twin/assets/{asset_code}/command",
                    json=reading,
                    headers=self._headers(),
                )
                if r.status_code == 401 or r.status_code == 403:
                    return TwinDeliveryResult(
                        delivered=False,
                        error=f"Twin authentication failed (HTTP {r.status_code}): token expired or invalid",
                        auth_error=True,
                        status_code=r.status_code,
                    )
                return TwinDeliveryResult(
                    delivered=r.status_code < 400,
                    error=None if r.status_code < 400 else f"HTTP {r.status_code}: {r.text[:200]}",
                    auth_error=False,
                    status_code=r.status_code,
                )
        except httpx.ConnectError as exc:
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin unreachable: {exc}",
                auth_error=False,
            )
        except httpx.TimeoutException as exc:
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin request timed out: {exc}",
                auth_error=False,
            )
        except Exception as exc:  # noqa: BLE001
            return TwinDeliveryResult(
                delivered=False,
                error=f"Twin request failed: {type(exc).__name__}: {exc}",
                auth_error=False,
            )
