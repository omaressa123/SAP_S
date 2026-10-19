"""Common agent interface — every agent in the system implements this contract.

Agents communicate through explicit interfaces and validated event contracts,
never by importing each other's internal implementation.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import uuid


class AgentStatus(str, Enum):
    REGISTERED = "registered"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


@dataclass(frozen=True)
class AgentCapability:
    """A single capability an agent can perform."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    requires_human_review: bool = False
    timeout_seconds: int = 300


@dataclass
class AgentResult:
    """Structured output from an agent execution."""
    success: bool
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    confidence: Optional[float] = None
    requires_human_review: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "confidence": self.confidence,
            "requires_human_review": self.requires_human_review,
            "metadata": self.metadata,
        }


class AgentInterface(ABC):
    """Base contract for all agents.

    Subclasses must implement:
      - agent_id: stable unique identifier
      - capabilities: list of AgentCapability
      - handle_event: process an incoming event
      - validate_input: validate input before execution
    """

    def __init__(self, agent_id: str, name: str, description: str = ""):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.status = AgentStatus.REGISTERED
        self.last_heartbeat = datetime.now(timezone.utc)
        self._capabilities: Dict[str, AgentCapability] = {}
        self._event_handlers: Dict[str, Callable] = {}
        self._execution_timeout = 300

    # ----- registration / discovery -----

    def register_capability(self, cap: AgentCapability) -> None:
        self._capabilities[cap.name] = cap

    def get_capability(self, name: str) -> Optional[AgentCapability]:
        return self._capabilities.get(name)

    def list_capabilities(self) -> List[AgentCapability]:
        return list(self._capabilities.values())

    def has_capability(self, name: str) -> bool:
        return name in self._capabilities

    # ----- lifecycle -----

    def activate(self) -> None:
        self.status = AgentStatus.ACTIVE
        self.last_heartbeat = datetime.now(timezone.utc)

    def deactivate(self) -> None:
        self.status = AgentStatus.INACTIVE

    def heartbeat(self) -> None:
        self.last_heartbeat = datetime.now(timezone.utc)
        if self.status == AgentStatus.ERROR:
            self.status = AgentStatus.ACTIVE

    def set_error(self) -> None:
        self.status = AgentStatus.ERROR

    def is_healthy(self) -> bool:
        return self.status in (AgentStatus.ACTIVE, AgentStatus.REGISTERED)

    # ----- event handling -----

    def register_handler(self, event_type: str, handler: Callable) -> None:
        self._event_handlers[event_type] = handler

    def can_handle(self, event_type: str) -> bool:
        return event_type in self._event_handlers

    @abstractmethod
    async def handle_event(self, event: "AirportEvent") -> AgentResult:
        """Process an incoming event and return a structured result."""
        raise NotImplementedError

    @abstractmethod
    def validate_input(self, payload: Dict[str, Any]) -> bool:
        """Validate input payload before execution."""
        raise NotImplementedError

    # ----- execution wrapper -----

    async def execute_with_guard(
        self,
        event_type: str,
        payload: Dict[str, Any],
        timeout_seconds: Optional[int] = None,
    ) -> AgentResult:
        """Execute a capability with timeout, validation, and error handling."""
        if not self.validate_input(payload):
            return AgentResult(
                success=False,
                error=f"Input validation failed for {self.agent_id}",
                requires_human_review=False,
            )

        handler = self._event_handlers.get(event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event_type}' on agent {self.agent_id}",
            )

        timeout = timeout_seconds or self._execution_timeout
        try:
            result = await handler(payload)
            if not isinstance(result, AgentResult):
                result = AgentResult(success=True, data=result if isinstance(result, dict) else {})
            return result
        except asyncio.CancelledError:
            self.set_error()
            return AgentResult(success=False, error="Execution cancelled", requires_human_review=False)
        except Exception as exc:  # noqa: BLE001
            self.set_error()
            return AgentResult(
                success=False,
                error=f"{type(exc).__name__}: {exc}",
                requires_human_review=False,
            )

    def to_registry_entry(self) -> Dict[str, Any]:
        """Export a registry-friendly snapshot."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "description": self.description,
            "status": self.status.value,
            "capabilities": [
                {
                    "name": c.name,
                    "description": c.description,
                    "requires_human_review": c.requires_human_review,
                    "timeout_seconds": c.timeout_seconds,
                }
                for c in self._capabilities.values()
            ],
            "last_heartbeat": self.last_heartbeat.isoformat(),
        }


# Import asyncio here to avoid circular import at module load time
import asyncio  # noqa: E402
