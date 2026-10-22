"""Agent package for the Smart Green Airport autonomous multi-agent system.

This layer coordinates the multi-agent system across Phase 1 core security,
Phase 2 autonomous domain operations (Flight Ops, Maintenance, Notifications,
and Sustainability), and Phase 3 distributed cognitive extensions.
"""
from .base import AgentInterface, AgentStatus, AgentCapability, AgentResult
from .registry import AgentRegistry
from .events import AirportEvent, EventSystem
from .orchestrator import AgentOrchestrator
from .identity_agent import IdentityAgent
from .baggage_agent import BaggageAgent
from .safety_agent import SafetyAgent
from .flight_ops_agent import FlightOpsAgent
from .maintenance_agent import MaintenanceAgent
from .notification_agent import NotificationAgent
from .sustainability_agent import SustainabilityAgent

__all__ = [
    "AgentInterface",
    "AgentStatus",
    "AgentCapability",
    "AgentResult",
    "AgentRegistry",
    "AirportEvent",
    "EventSystem",
    "AgentOrchestrator",
    "IdentityAgent",
    "BaggageAgent",
    "SafetyAgent",
    "FlightOpsAgent",
    "MaintenanceAgent",
    "NotificationAgent",
    "SustainabilityAgent",
]
