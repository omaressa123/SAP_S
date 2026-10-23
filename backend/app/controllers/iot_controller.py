"""IoT MQTT bridge control endpoints (M2.6).

Endpoints (all under /api/v1/agents/iot):
  GET    /iot/health            — bridge + command health summary
  GET    /iot/commands          — list command logs (filter by device/status)
  GET    /iot/commands/{id}     — single command detail with ack state
  POST   /iot/dispatch          — record + dispatch a validated command to a device

Protected by the existing X-API-KEY authentication. Commands are persisted to
iotcommandlog and published over MQTT by the bridge worker; the API never
claims a physical action succeeded without a device acknowledgement.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import json
from fastapi import APIRouter, Depends, Body, Query, Path

from ..utils.auth import verify_api_key
from ..utils.response_envelope import success_response, error_response
from ..utils.errors import AirportException
from ..database import SessionLocal
from ..models.iot import IotCommandLog
from ..config import settings
from ..agents.service import agent_service

router = APIRouter()

DEFAULT_TIMEOUT_SECONDS = 30

KNOWN_MODULES = {
    "gate", "passenger-counter", "baggage", "emergency", "fire-smoke",
    "environment", "elevator", "ground-iot", "aircraft-parking", "charging",
    "equipment", "security",
}

KNOWN_COMMANDS = {
    "gate": {"OPEN", "CLOSE", "LOCK", "UNLOCK", "RESET", "GET_STATUS", "AUTH_PASSENGER"},
    "baggage": {"SORT", "DIVERT", "TAG_DETECT", "LOCK", "UNLOCK", "RESET", "GET_STATUS"},
    "security": {"OPEN", "CLOSE", "LOCK", "UNLOCK", "EMERGENCY_STOP", "RESET", "GET_STATUS", "AUTHORIZE"},
    "fire-smoke": {"TEST_ALARM", "SILENCE", "RESET", "GET_STATUS"},
    "environment": {"FAN_ON", "FAN_OFF", "FAN_AUTO", "RESET", "GET_STATUS"},
    "equipment": {"START", "STOP", "RESET", "MAINTENANCE", "GET_STATUS"},
    "charging": {"CONNECT_VEHICLE", "DISCONNECT_VEHICLE", "START_CHARGING",
                 "STOP_CHARGING", "EMERGENCY_STOP", "RESET", "GET_STATUS"},
    "passenger-counter": {"RESET", "SET_OCCUPANCY", "GET_STATUS", "SIMULATE_ENTRY", "SIMULATE_EXIT"},
    "ground-iot": {"START_SIMULATION", "AIRCRAFT_ARRIVAL", "AIRCRAFT_DEPARTURE", "RESET", "GET_STATUS"},
    "aircraft-parking": {"START_SIMULATION", "AIRCRAFT_ARRIVAL", "AIRCRAFT_DEPARTURE", "RESET", "GET_STATUS"},
    "emergency": {"TRIGGER", "EVACUATE", "LOCKDOWN", "SILENCE", "RESET", "GET_STATUS"},
    "elevator": {"CALL_UP", "CALL_DOWN", "OPEN_DOOR", "CLOSE_DOOR", "OVERLOAD_ON",
                 "OVERLOAD_OFF", "EMERGENCY_STOP", "RESET", "GET_STATUS"},
}


def _bridge():
    try:
        return agent_service.get_mqtt_bridge()
    except RuntimeError:
        return None


@router.get("/iot/health", dependencies=[Depends(verify_api_key)])
def iot_health():
    bridge = _bridge()
    if bridge is not None:
        h = bridge.get_health()
        return success_response(data={
            "connected": h.connected,
            "broker": h.broker,
            "port": h.port,
            "pending_commands": h.pending_commands,
            "acknowledged_commands": h.acknowledged_commands,
            "timed_out_commands": h.timed_out_commands,
            "last_telemetry_at": h.last_telemetry_at,
            "error": h.error,
        })
    # Fallback: DB-backed summary when the bridge worker is not running.
    db = SessionLocal()
    try:
        rows = db.query(IotCommandLog).all()
        pending = sum(1 for r in rows if r.status in ("pending", "dispatched"))
        acked = sum(1 for r in rows if r.status == "acknowledged")
        timed_out = sum(1 for r in rows if r.status == "timeout")
    finally:
        db.close()
    return success_response(data={
        "connected": None,
        "broker": settings.MQTT_BROKER,
        "port": settings.MQTT_PORT,
        "pending_commands": pending,
        "acknowledged_commands": acked,
        "timed_out_commands": timed_out,
        "last_telemetry_at": None,
        "error": "bridge worker not running",
    })


@router.get("/iot/commands", dependencies=[Depends(verify_api_key)])
def list_commands(
    limit: int = Query(50, ge=1, le=500),
    device_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    bridge = _bridge()
    if bridge is not None:
        return success_response(data=bridge.list_commands(limit=limit, device_id=device_id, status=status))
    db = SessionLocal()
    try:
        q = db.query(IotCommandLog).order_by(IotCommandLog.created_at.desc())
        if device_id:
            q = q.filter(IotCommandLog.device_id == device_id)
        if status:
            q = q.filter(IotCommandLog.status == status)
        rows = q.limit(limit).all()
        data = [{
            "command_id": r.command_id, "device_id": r.device_id, "module": r.module,
            "command": r.command, "status": r.status, "ack_received": r.ack_received,
            "dispatched_by_agent": r.dispatched_by_agent,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        } for r in rows]
    finally:
        db.close()
    return success_response(data=data)


@router.get("/iot/commands/{command_id}", dependencies=[Depends(verify_api_key)])
def get_command(command_id: str = Path(...)):
    bridge = _bridge()
    if bridge is not None:
        cmd = bridge.get_command(command_id)
        if cmd is None:
            return error_response(code="COMMAND_NOT_FOUND", message=f"Command {command_id} not found", status_code=404)
        return success_response(data=cmd)
    db = SessionLocal()
    try:
        row = db.query(IotCommandLog).filter(IotCommandLog.command_id == command_id).first()
    finally:
        db.close()
    if row is None:
        return error_response(code="COMMAND_NOT_FOUND", message=f"Command {command_id} not found", status_code=404)
    return success_response(data={
        "command_id": row.command_id, "device_id": row.device_id, "module": r.module if False else row.module,
        "command": row.command, "status": row.status, "ack_received": row.ack_received,
        "dispatched_by_agent": row.dispatched_by_agent,
    })


@router.post("/iot/dispatch", dependencies=[Depends(verify_api_key)])
def dispatch_command(
    device_id: str = Body(..., embed=True),
    module: str = Body(..., embed=True),
    command: str = Body(..., embed=True),
    agent_id: str = Body(..., embed=True),
    payload: Optional[Dict[str, Any]] = Body(None, embed=True),
    correlation_id: Optional[str] = Body(None, embed=True),
    timeout_seconds: int = Body(DEFAULT_TIMEOUT_SECONDS, embed=True),
):
    """Dispatch a validated command to a field device.

    The command is persisted (status=pending) and handed to the MQTT bridge
    for publishing. It is only marked acknowledged when the device replies
    with a valid acknowledgement matching this command id.
    """
    if module not in KNOWN_MODULES:
        return error_response(code="INVALID_MODULE", message=f"Unknown module '{module}'", status_code=400)
    allowed = KNOWN_COMMANDS.get(module)
    if allowed is not None and command not in allowed:
        return error_response(
            code="INVALID_COMMAND", message=f"Command '{command}' not supported for module '{module}'",
            status_code=400,
        )
    if timeout_seconds < 1 or timeout_seconds > 300:
        return error_response(code="INVALID_TIMEOUT", message="timeout_seconds must be between 1 and 300", status_code=400)

    bridge = _bridge()
    if bridge is not None:
        try:
            cmd_id = bridge.publish_command(
                device_id=device_id, module=module, command=command, payload=payload,
                agent_id=agent_id, correlation_id=correlation_id,
                timeout_seconds=timeout_seconds,
            )
            return success_response(data={"command_id": cmd_id, "status": "pending"})
        except AirportException:
            raise
        except Exception as exc:  # noqa: BLE001
            return error_response(code="COMMAND_DISPATCH_FAILED", message=str(exc), status_code=500)

    # Bridge not running: persist as pending for the bridge worker to pick up.
    import uuid
    from datetime import datetime, timezone, timedelta
    from ..database import SessionLocal as _SL
    cmd_id = f"cmd_{uuid.uuid4().hex[:12]}"
    db = _SL()
    try:
        row = IotCommandLog(
            command_id=cmd_id, correlation_id=correlation_id, device_id=device_id,
            module=module, topic=f"airport/{module}/{device_id}/command",
            command=command, payload=json.dumps(payload or {}),
            dispatched_by_agent=agent_id, status="pending",
            timeout_seconds=timeout_seconds,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=timeout_seconds),
        )
        db.add(row)
        db.commit()
    finally:
        db.close()
    return success_response(data={"command_id": cmd_id, "status": "pending"})
