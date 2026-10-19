"""Agent registry — registers available agents, tracks capabilities and health.

Prevents duplicate registration of the same agent_id. Provides a snapshot
for observability endpoints.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .base import AgentInterface, AgentStatus, AgentCapability


@dataclass
class AgentRecord:
    agent: AgentInterface
    registered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AgentRegistry:
    """Central registry for all agents in the system."""

    def __init__(self):
        self._agents: Dict[str, AgentRecord] = {}

    def register(self, agent: AgentInterface) -> bool:
        """Register an agent. Returns False if agent_id already exists."""
        if agent.agent_id in self._agents:
            return False
        agent.activate()
        self._agents[agent.agent_id] = AgentRecord(agent=agent)
        return True

    def unregister(self, agent_id: str) -> bool:
        if agent_id not in self._agents:
            return False
        self._agents[agent_id].agent.deactivate()
        del self._agents[agent_id]
        return True

    def get(self, agent_id: str) -> Optional[AgentInterface]:
        record = self._agents.get(agent_id)
        return record.agent if record else None

    def list_agents(self) -> List[AgentInterface]:
        return [r.agent for r in self._agents.values()]

    def list_active(self) -> List[AgentInterface]:
        return [r.agent for r in self._agents.values() if r.agent.is_healthy()]

    def heartbeat(self, agent_id: str) -> bool:
        agent = self.get(agent_id)
        if agent:
            agent.heartbeat()
            return True
        return False

    def set_error(self, agent_id: str) -> bool:
        agent = self.get(agent_id)
        if agent:
            agent.set_error()
            return True
        return False

    def snapshot(self) -> Dict[str, Any]:
        """Export registry state for observability."""
        return {
            "total": len(self._agents),
            "active": len(self.list_active()),
            "agents": [r.agent.to_registry_entry() for r in self._agents.values()],
        }

    def find_by_capability(self, capability_name: str) -> List[AgentInterface]:
        """Find all agents that have a given capability."""
        return [
            r.agent
            for r in self._agents.values()
            if r.agent.has_capability(capability_name) and r.agent.is_healthy()
        ]
