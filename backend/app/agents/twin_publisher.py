"""Digital Twin event publisher.

Publishes agent state changes to the existing Digital Twin REST API
(airport-twin, port 8100) via the /api/twin/ingest and
/api/twin/assets/{code}/command endpoints. Reuses the existing twin
infrastructure — no new messaging layer is introduced.

The Digital Twin remains responsible for visualization; agents only publish
structured state changes. The twin is never the source of operational
decisions.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx
import json


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
    ) -> bool:
        """Publish a state change for a twin asset via /api/twin/ingest.

        Returns True if the event was accepted (or if the twin is unreachable
        — failure is non-fatal for the agent workflow).
        """
        reading = {
            "asset_code": entity_code,
            "asset_type": entity_type,
            "status": status,
            "payload": payload or {},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    f"{self.twin_base_url}/api/twin/ingest",
                    json=reading,
                    headers=self._headers(),
                )
                return r.status_code < 400
        except Exception:  # noqa: BLE001
            # Twin unreachable — non-fatal; agent workflow continues
            return False

    async def publish_agent_event(
        self,
        asset_code: str,
        event_type: str,
        payload: Dict[str, Any] | None = None,
    ) -> bool:
        """Publish an agent event as a twin asset event."""
        reading = {
            "asset_code": asset_code,
            "asset_type": "agent_event",
            "status": event_type,
            "payload": payload or {},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    f"{self.twin_base_url}/api/twin/ingest",
                    json=reading,
                    headers=self._headers(),
                )
                return r.status_code < 400
        except Exception:  # noqa: BLE001
            return False

    async def send_command(
        self,
        asset_code: str,
        command: str,
        params: Dict[str, Any] | None = None,
    ) -> bool:
        """Send a command to a twin asset (audited + WebSocket broadcast).

        Commands are simulated only — no real-world equipment control.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(
                    f"{self.twin_base_url}/api/twin/assets/{asset_code}/command",
                    json={"command": command, "params": params or {}},
                    headers=self._headers(),
                )
                return r.status_code < 400
        except Exception:  # noqa: BLE001
            return False
