"""Sustainability & Energy Agent — optimizes microgrid power, HVAC setpoints, and solar dispatch.

Responsibilities:
  - Dynamically regulate HVAC and lighting load based on live terminal occupancy
  - Monitor on-site solar PV generation and battery storage status
  - Execute microgrid peak-shaving during peak electricity tariff windows
  - Track carbon avoidance metrics for sustainability accounting
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone

from ..database import SessionLocal
from ..models.sustainability import EnergyConsumptionLog, EnergyGenerationLog
from ..models.wayfinding import Zone
from .base import AgentInterface, AgentCapability, AgentResult


class SustainabilityAgent(AgentInterface):
    """Agent for airport energy optimization, microgrid regulation, and carbon reporting."""

    def __init__(self):
        super().__init__(
            agent_id="sustainability_agent",
            name="Sustainability & Energy Agent",
            description="Optimizes microgrid power, HVAC setpoints, solar utilization, and carbon savings.",
        )
        self.register_capability(AgentCapability(
            name="optimize_energy",
            description="Compute optimal HVAC setpoint and lighting percentage based on zone occupancy",
            input_schema={
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer"},
                    "current_occupancy": {"type": "integer"},
                    "ambient_temp_c": {"type": "number"},
                },
                "required": ["zone_id"],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "zone_id": {"type": "integer"},
                    "hvac_setpoint_c": {"type": "number"},
                    "lighting_level_pct": {"type": "integer"},
                    "estimated_power_saving_kw": {"type": "number"},
                },
            },
            requires_human_review=False,
            timeout_seconds=20,
        ))

        self.register_capability(AgentCapability(
            name="calculate_footprint",
            description="Report energy yield and estimated carbon offsets from solar installations",
            input_schema={
                "type": "object",
                "properties": {
                    "solar_kwh": {"type": "number"},
                },
                "required": [],
            },
            output_schema={
                "type": "object",
                "properties": {
                    "solar_kwh": {"type": "number"},
                    "co2_avoided_kg": {"type": "number"},
                },
            },
            requires_human_review=False,
            timeout_seconds=20,
        ))

        # Register event handlers
        self.register_handler("occupancy_update", self._handle_occupancy_update)
        self.register_handler("solar_peak_yield", self._handle_solar_event)
        self.register_handler("peak_demand_tariff_start", self._handle_peak_demand)
        self.register_handler("zone_empty_powerdown", self._handle_powerdown)

    def validate_input(self, payload: Dict[str, Any]) -> bool:
        if not isinstance(payload, dict):
            return False
        return "zone_id" in payload or "solar_kwh" in payload or "occupancy" in payload

    async def handle_event(self, event) -> AgentResult:
        handler = self._event_handlers.get(event.event_type)
        if handler is None:
            return AgentResult(
                success=False,
                error=f"No handler for event type '{event.event_type}'",
            )
        return await handler(event.payload)

    async def _handle_occupancy_update(self, payload: Dict[str, Any]) -> AgentResult:
        zone_id = payload.get("zone_id", 1)
        occupancy = int(payload.get("current_occupancy", payload.get("occupancy", 100)))

        # Energy policy:
        # High occupancy (>400 pax): HVAC 21.5°C, Lighting 100%
        # Medium occupancy (100-400 pax): HVAC 22.5°C, Lighting 80%
        # Low occupancy (<100 pax): HVAC 24.0°C, Lighting 50%
        if occupancy > 400:
            hvac = 21.5
            light = 100
            saving_kw = 0.0
        elif occupancy >= 100:
            hvac = 22.5
            light = 80
            saving_kw = 12.5
        else:
            hvac = 24.0
            light = 50
            saving_kw = 28.0

        db = SessionLocal()
        try:
            zone = db.query(Zone).filter(Zone.zone_id == zone_id).first()
            if zone:
                zone.current_occupancy = occupancy
                db.commit()

            return AgentResult(
                success=True,
                data={
                    "zone_id": zone_id,
                    "occupancy": occupancy,
                    "hvac_setpoint_c": hvac,
                    "lighting_level_pct": light,
                    "estimated_power_saving_kw": saving_kw,
                    "status": "OPTIMIZED",
                },
            )
        except Exception as exc:
            db.rollback()
            return AgentResult(success=False, error=str(exc))
        finally:
            db.close()

    async def _handle_solar_event(self, payload: Dict[str, Any]) -> AgentResult:
        solar_kwh = float(payload.get("solar_kwh", 150.0))
        # Factor: ~0.42 kg CO2 avoided per solar kWh
        co2_kg = round(solar_kwh * 0.42, 2)
        return AgentResult(
            success=True,
            data={
                "solar_kwh": solar_kwh,
                "co2_avoided_kg": co2_kg,
                "battery_charge_recommended": True,
                "status": "SOLAR_YIELD_RECORDED",
            },
        )

    async def _handle_peak_demand(self, payload: Dict[str, Any]) -> AgentResult:
        return AgentResult(
            success=True,
            data={
                "strategy": "PEAK_SHAVING",
                "battery_dispatch_kw": 45.0,
                "hvac_precool_offset_c": 1.0,
                "status": "PEAK_SHAVING_ACTIVE",
            },
        )

    async def _handle_powerdown(self, payload: Dict[str, Any]) -> AgentResult:
        zone_id = payload.get("zone_id", 1)
        return AgentResult(
            success=True,
            data={
                "zone_id": zone_id,
                "action": "POWERDOWN_STANDBY",
                "lighting_level_pct": 20,
                "hvac_setpoint_c": 25.0,
                "status": "STANDBY_MODE",
            },
        )

