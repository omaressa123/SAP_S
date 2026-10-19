"""Agent package for the Smart Green Airport autonomous multi-agent system.

This layer sits on top of the existing backend, AI microservices, database,
and Digital Twin. It does NOT retrain or replace any existing model — it
wraps them in typed adapters and orchestrates deterministic workflows.
"""
from .base import AgentInterface, AgentStatus, AgentCapability, AgentResult
from .registry import AgentRegistry
from .events import AirportEvent, EventSystem
from .orchestrator import AgentOrchestrator

__all__ = [
    "AgentInterface",
    "AgentStatus",
    "AgentCapability",
    "AgentResult",
    "AgentRegistry",
    "AirportEvent",
    "EventSystem",
    "AgentOrchestrator",
]
