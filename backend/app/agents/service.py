"""Agent service — wires registry, orchestrator, event system, agents, and
twin publisher together. Singleton-style initialization for the FastAPI app."""
from __future__ import annotations

from typing import Optional

from ..database import SessionLocal
from .registry import AgentRegistry
from .events import EventSystem
from .orchestrator import AgentOrchestrator
from .identity_agent import IdentityAgent
from .baggage_agent import BaggageAgent
from .safety_agent import SafetyAgent
from .twin_publisher import TwinPublisher
from .adapters.face import FaceVerificationAdapter
from .adapters.baggage import BaggageThreatAdapter
from .adapters.safety import SafetyAdapter


class AgentService:
    """Central agent service. Initialized once at app startup."""

    def __init__(self):
        self.registry: Optional[AgentRegistry] = None
        self.event_system: Optional[EventSystem] = None
        self.orchestrator: Optional[AgentOrchestrator] = None
        self.identity_agent: Optional[IdentityAgent] = None
        self.baggage_agent: Optional[BaggageAgent] = None
        self.safety_agent: Optional[SafetyAgent] = None
        self.twin_publisher: Optional[TwinPublisher] = None
        self.initialized = False

    def init(
        self,
        face_service_url: Optional[str] = None,
        baggage_backend_url: Optional[str] = None,
        smoke_fire_url: Optional[str] = None,
        fall_detection_url: Optional[str] = None,
        twin_base_url: str = "http://localhost:8100",
        twin_auth_token: Optional[str] = None,
    ) -> None:
        if self.initialized:
            return

        # Core infrastructure
        self.registry = AgentRegistry()
        self.event_system = EventSystem(db_session_factory=SessionLocal)
        self.orchestrator = AgentOrchestrator(
            registry=self.registry,
            event_system=self.event_system,
        )
        self.twin_publisher = TwinPublisher(
            twin_base_url=twin_base_url,
            auth_token=twin_auth_token,
        )

        # Model adapters (wrap existing AI services)
        face_adapter = FaceVerificationAdapter(service_url=face_service_url)
        baggage_adapter = BaggageThreatAdapter(backend_url=baggage_backend_url)
        safety_adapter = SafetyAdapter(
            smoke_fire_url=smoke_fire_url,
            fall_detection_url=fall_detection_url,
        )

        # Agents
        self.identity_agent = IdentityAgent(face_service_url=face_service_url)
        self.baggage_agent = BaggageAgent(backend_url=baggage_backend_url)
        self.safety_agent = SafetyAgent(
            smoke_fire_url=smoke_fire_url,
            fall_detection_url=fall_detection_url,
        )

        # Register agents
        self.registry.register(self.identity_agent)
        self.registry.register(self.baggage_agent)
        self.registry.register(self.safety_agent)

        # Subscribe event system to orchestrator routing
        # (orchestrator handles routing via ingest_event)

        self.initialized = True

    def get_orchestrator(self) -> AgentOrchestrator:
        if not self.initialized or not self.orchestrator:
            raise RuntimeError("AgentService not initialized")
        return self.orchestrator

    def get_registry(self) -> AgentRegistry:
        if not self.initialized or not self.registry:
            raise RuntimeError("AgentService not initialized")
        return self.registry

    def get_event_system(self) -> EventSystem:
        if not self.initialized or not self.event_system:
            raise RuntimeError("AgentService not initialized")
        return self.event_system

    def get_twin_publisher(self) -> TwinPublisher:
        if not self.initialized or not self.twin_publisher:
            raise RuntimeError("AgentService not initialized")
        return self.twin_publisher

    def snapshot(self) -> dict:
        if not self.initialized:
            return {"initialized": False}
        return {
            "initialized": True,
            "registry": self.registry.snapshot(),
            "recent_events": self.event_system.get_recent(limit=50),
        }


# Module-level singleton
agent_service = AgentService()
