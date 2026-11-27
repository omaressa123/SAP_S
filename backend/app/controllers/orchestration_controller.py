"""Multi-Agent Workflow Orchestration & AI Agent Notification endpoints.

All endpoints under /api/v1/agents:
  - /models                 : Discover actual AI models in AI/ and probe live microservice health
  - /devices                : List / register airport devices (Equipment + Camera + Zone)
  - /deployments            : Create, list, stop, restart, repair, duplicate, remove agent deployments
  - /notifications          : AI agent operational notifications (read, acknowledge, resolve)
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..ai_registry import AI_MODULES
from ..agents.service import agent_service
from ..database import get_db
from ..models.admin_cameras import Camera
from ..models.agents import AgentDeployment, AgentNotification
from ..models.devices import Equipment
from ..models.wayfinding import Zone
from ..utils.auth import verify_api_key
from ..utils.response_envelope import error_response, success_response

router = APIRouter()

# Compatibility matrix between existing AI models and airport device types
MODEL_COMPATIBILITY: Dict[str, Dict[str, Any]] = {
    "face_recognition": {
        "agent_type": "Face Recognition Agent",
        "compatible_device_types": ["camera", "kiosk", "security_gate", "boarding_gate", "egate"],
        "default_input": "Camera Feed / Kiosk Capture",
        "default_output": "Biometric Verification & Gate Control",
        "runtime_agent_id": "identity_agent",
    },
    "baggage_threat_detection": {
        "agent_type": "Baggage Threat Detection Agent",
        "compatible_device_types": ["xray", "scanner", "baggage_scanner", "conveyor", "camera"],
        "default_input": "X-Ray Baggage Scanner Stream",
        "default_output": "Threat Inspection & Sorter Hold",
        "runtime_agent_id": "baggage_agent",
    },
    "baggage_person_detection": {
        "agent_type": "Baggage & Person Detection Agent",
        "compatible_device_types": ["camera", "cctv", "kiosk", "conveyor"],
        "default_input": "Terminal CCTV Camera Feed",
        "default_output": "Scene Object Tracking & Alerts",
        "runtime_agent_id": "safety_agent",
    },
    "smoke_fire_detection": {
        "agent_type": "Smoke & Fire Detection Agent",
        "compatible_device_types": ["camera", "cctv", "sensor", "fire_sensor"],
        "default_input": "Zone Camera & Environmental Feed",
        "default_output": "Emergency Fire Alert & Dispatch",
        "runtime_agent_id": "safety_agent",
    },
    "full_scene_detection": {
        "agent_type": "Fall & Unified Detection Agent",
        "compatible_device_types": ["camera", "cctv", "sensor"],
        "default_input": "Terminal CCTV Video Stream",
        "default_output": "Pose/Fall & Safety Alert Output",
        "runtime_agent_id": "safety_agent",
    },
}

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _probe_model_health(model: Dict[str, Any]) -> Dict[str, Any]:
    """Probe the real microservice /health endpoint or verify local model artifact."""
    svc_url = (model.get("service_url") or "").strip()
    if svc_url:
        health_url = svc_url.rstrip("/") + "/health"
        try:
            with httpx.Client(timeout=1.5) as client:
                r = client.get(health_url)
                if r.status_code < 400:
                    return {"reachable": True, "status": "online", "health_url": health_url, "error": None}
                return {
                    "reachable": False,
                    "status": "error",
                    "health_url": health_url,
                    "error": f"HTTP {r.status_code} from {health_url}",
                }
        except Exception as exc:  # noqa: BLE001
            return {
                "reachable": False,
                "status": "offline",
                "health_url": health_url,
                "error": str(exc)[:240],
            }

    # In-process / local model directory check
    local_mod = model.get("local_module") or ""
    mod_path = os.path.join(_REPO_ROOT, local_mod)
    if local_mod and os.path.exists(mod_path):
        return {"reachable": True, "status": "online", "health_url": f"local://{local_mod}", "error": None}
    return {
        "reachable": False,
        "status": "offline",
        "health_url": f"local://{local_mod}",
        "error": f"Local model directory not found: {local_mod}",
    }


def _emit_notification(
    db: Session,
    *,
    deployment: Optional[AgentDeployment],
    agent_name: str,
    model_name: str,
    device_id: Optional[int],
    device_label: Optional[str],
    severity: str,
    event_kind: str,
    description: str,
    agent_status: str,
    recommended_action: Optional[str] = None,
    dedupe_open: bool = True,
) -> AgentNotification:
    """Create a persistent AgentNotification, deduplicating identical open alerts."""
    if dedupe_open and deployment is not None:
        existing = (
            db.query(AgentNotification)
            .filter(
                AgentNotification.deployment_id == deployment.deployment_id,
                AgentNotification.event_kind == event_kind,
                AgentNotification.status == "open",
            )
            .first()
        )
        if existing:
            return existing

    notif = AgentNotification(
        notification_id=f"notif-{uuid.uuid4().hex[:10]}",
        deployment_id=deployment.deployment_id if deployment else None,
        agent_name=agent_name,
        model_name=model_name,
        device_id=device_id,
        device_label=device_label,
        severity=severity,
        event_kind=event_kind,
        description=description,
        agent_status=agent_status,
        recommended_action=recommended_action,
        is_read=False,
        status="open",
        created_at=datetime.utcnow(),
    )
    db.add(notif)
    return notif


def _sync_deployments_health(db: Session) -> List[AgentDeployment]:
    """Check real device status and AI service health for all non-stopped deployments."""
    deployments = db.query(AgentDeployment).order_by(AgentDeployment.created_at.asc()).all()
    if not deployments:
        return []

    model_map = {m["id"]: m for m in AI_MODULES}
    health_cache: Dict[str, Dict[str, Any]] = {}
    equip_map = {e.equipment_id: e for e in db.query(Equipment).all()}

    for dep in deployments:
        if dep.status == "stopped":
            continue

        model = model_map.get(dep.model_id)
        if not model:
            prev_status = dep.status
            dep.status = "failed"
            dep.processing_status = "halted"
            dep.last_error = f"Model '{dep.model_id}' not found in AI registry."
            if prev_status != "failed":
                _emit_notification(
                    db,
                    deployment=dep,
                    agent_name=dep.agent_name,
                    model_name=dep.model_name,
                    device_id=dep.device_id,
                    device_label=dep.device_label,
                    severity="critical",
                    event_kind="model_init_failed",
                    description=dep.last_error,
                    agent_status="failed",
                    recommended_action="Verify model files or redeploy with a valid AI model.",
                )
            continue

        # Check assigned device status
        equip = equip_map.get(dep.device_id) if dep.device_id is not None else None
        if dep.device_id is not None and (equip is None or (equip.status or "").lower() in ("offline", "fault", "down", "maintenance")):
            reason = (
                f"Assigned device #{dep.device_id} not found in database."
                if equip is None
                else f"Assigned device {equip.label or dep.device_id} is '{equip.status}'."
            )
            prev_status = dep.status
            dep.status = "offline"
            dep.processing_status = "disconnected"
            dep.last_error = reason
            if prev_status != "offline":
                _emit_notification(
                    db,
                    deployment=dep,
                    agent_name=dep.agent_name,
                    model_name=dep.model_name,
                    device_id=dep.device_id,
                    device_label=dep.device_label,
                    severity="critical",
                    event_kind="device_disconnected",
                    description=reason,
                    agent_status="offline",
                    recommended_action="Check device connectivity or redeploy this agent to an available device.",
                )
            continue

        # Probe AI service health
        if dep.model_id not in health_cache:
            health_cache[dep.model_id] = _probe_model_health(model)
        probe = health_cache[dep.model_id]

        if not probe["reachable"]:
            prev_status = dep.status
            dep.status = "offline" if probe["status"] == "offline" else "failed"
            dep.processing_status = "disconnected" if probe["status"] == "offline" else "halted"
            dep.last_error = probe["error"] or "AI model service unreachable"
            if prev_status not in ("offline", "failed"):
                _emit_notification(
                    db,
                    deployment=dep,
                    agent_name=dep.agent_name,
                    model_name=dep.model_name,
                    device_id=dep.device_id,
                    device_label=dep.device_label,
                    severity="critical",
                    event_kind="offline" if dep.status == "offline" else "crash",
                    description=f"AI service unreachable: {dep.last_error}",
                    agent_status=dep.status,
                    recommended_action="Attempt Repair/Restart or verify the AI container health.",
                )
        else:
            prev_status = dep.status
            dep.last_heartbeat = datetime.utcnow()
            if prev_status in ("offline", "failed"):
                dep.status = "running"
                dep.processing_status = "ready"
                dep.last_error = None
                _emit_notification(
                    db,
                    deployment=dep,
                    agent_name=dep.agent_name,
                    model_name=dep.model_name,
                    device_id=dep.device_id,
                    device_label=dep.device_label,
                    severity="info",
                    event_kind="recovered",
                    description=f"Agent '{dep.agent_name}' recovered and reconnected to {dep.model_name}.",
                    agent_status="running",
                    recommended_action=None,
                    dedupe_open=False,
                )

    db.commit()
    return deployments


def _serialize_deployment(dep: AgentDeployment) -> Dict[str, Any]:
    return {
        "deployment_id": dep.deployment_id,
        "agent_name": dep.agent_name,
        "agent_type": dep.agent_type,
        "model_id": dep.model_id,
        "model_name": dep.model_name,
        "device_id": dep.device_id,
        "device_label": dep.device_label,
        "location": dep.location,
        "input_source": dep.input_source,
        "output_destination": dep.output_destination,
        "status": dep.status,
        "processing_status": dep.processing_status,
        "health_url": dep.health_url,
        "config": json.loads(dep.config_json) if dep.config_json else {},
        "last_error": dep.last_error,
        "last_heartbeat": dep.last_heartbeat.isoformat() + "Z" if dep.last_heartbeat else None,
        "created_at": dep.created_at.isoformat() + "Z" if dep.created_at else None,
        "updated_at": dep.updated_at.isoformat() + "Z" if dep.updated_at else None,
    }


def _serialize_notification(n: AgentNotification) -> Dict[str, Any]:
    return {
        "notification_id": n.notification_id,
        "deployment_id": n.deployment_id,
        "agent_name": n.agent_name,
        "model_name": n.model_name,
        "device_id": n.device_id,
        "device_label": n.device_label,
        "severity": n.severity,
        "event_kind": n.event_kind,
        "description": n.description,
        "agent_status": n.agent_status,
        "recommended_action": n.recommended_action,
        "is_read": n.is_read,
        "status": n.status,
        "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
        "acknowledged_at": n.acknowledged_at.isoformat() + "Z" if n.acknowledged_at else None,
        "resolved_at": n.resolved_at.isoformat() + "Z" if n.resolved_at else None,
    }


class DeviceCreateRequest(BaseModel):
    label: str
    equipment_type: str = "camera"
    serial_number: str
    model: Optional[str] = None
    zone_id: Optional[int] = None
    location: Optional[str] = None
    status: str = "operational"


class DeploymentCreateRequest(BaseModel):
    agent_name: str
    model_id: str
    device_id: Optional[int] = None
    location: Optional[str] = None
    input_source: Optional[str] = None
    output_destination: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class DuplicateDeploymentRequest(BaseModel):
    device_id: int
    agent_name: Optional[str] = None
    location: Optional[str] = None


@router.get("/models", dependencies=[Depends(verify_api_key)])
def list_ai_models():
    """Return actual AI models in AI/ with live service health and device compatibility."""
    result = []
    for m in AI_MODULES:
        probe = _probe_model_health(m)
        compat = MODEL_COMPATIBILITY.get(m["id"], {})
        result.append({
            **m,
            "agent_type": compat.get("agent_type", m["name"]),
            "compatible_device_types": compat.get("compatible_device_types", []),
            "default_input": compat.get("default_input", "Camera / Sensor Input"),
            "default_output": compat.get("default_output", "Processing Output"),
            "health": probe,
        })
    return success_response(data=result)


@router.get("/devices", dependencies=[Depends(verify_api_key)])
def list_devices(db: Session = Depends(get_db)):
    """Return all registered airport devices from PostgreSQL (Equipment + Camera + Zone)."""
    zones = {z.zone_id: z for z in db.query(Zone).all()}
    cameras = {c.equipment_id: c for c in db.query(Camera).all() if c.equipment_id is not None}
    deployments = db.query(AgentDeployment).all()
    dep_counts: Dict[int, int] = {}
    for d in deployments:
        if d.device_id is not None:
            dep_counts[d.device_id] = dep_counts.get(d.device_id, 0) + 1

    devices = []
    for eq in db.query(Equipment).order_by(Equipment.equipment_id.asc()).all():
        cam = cameras.get(eq.equipment_id)
        zone = zones.get(eq.zone_id) if eq.zone_id else None
        devices.append({
            "equipment_id": eq.equipment_id,
            "equipment_type": eq.equipment_type,
            "label": eq.label,
            "serial_number": eq.serial_number,
            "model": eq.model,
            "status": eq.status,
            "zone_id": eq.zone_id,
            "zone_name": zone.name if zone else None,
            "location": cam.location if cam else (zone.name if zone else None),
            "camera_id": cam.camera_id if cam else None,
            "deployed_agents": dep_counts.get(eq.equipment_id, 0),
        })
    return success_response(data=devices)


@router.post("/devices", dependencies=[Depends(verify_api_key)])
def register_device(payload: DeviceCreateRequest, db: Session = Depends(get_db)):
    """Register a new airport device (e.g. a new Face Recognition camera at a gate)."""
    existing = db.query(Equipment).filter(Equipment.serial_number == payload.serial_number).first()
    if existing:
        return error_response(
            code="DEVICE_EXISTS",
            message=f"Device with serial number '{payload.serial_number}' already exists.",
            status_code=409,
        )
    eq = Equipment(
        equipment_type=payload.equipment_type,
        label=payload.label,
        serial_number=payload.serial_number,
        model=payload.model,
        zone_id=payload.zone_id,
        status=payload.status,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(eq)
    db.flush()

    if payload.equipment_type.lower() in ("camera", "cctv", "egate", "kiosk") and payload.location:
        cam = Camera(
            location=payload.location,
            status=payload.status,
            equipment_id=eq.equipment_id,
            zone_id=payload.zone_id,
        )
        db.add(cam)

    db.commit()
    db.refresh(eq)
    return success_response(data={
        "equipment_id": eq.equipment_id,
        "equipment_type": eq.equipment_type,
        "label": eq.label,
        "serial_number": eq.serial_number,
        "status": eq.status,
        "location": payload.location,
    })


@router.get("/deployments", dependencies=[Depends(verify_api_key)])
def list_deployments(sync: bool = Query(True), db: Session = Depends(get_db)):
    """List deployed AI agent instances, runtime agents, and workflow connections."""
    deployments = _sync_deployments_health(db) if sync else db.query(AgentDeployment).order_by(AgentDeployment.created_at.asc()).all()
    runtime_agents = []
    if agent_service.initialized and agent_service.registry:
        runtime_agents = agent_service.registry.snapshot().get("agents", [])

    # Build directional workflow connections from real deployments
    connections = []
    for dep in deployments:
        conn_state = "inactive"
        if dep.status == "running":
            conn_state = "warning" if dep.processing_status == "degraded" else "active"
        elif dep.status == "idle":
            conn_state = "warning"
        elif dep.status in ("failed", "offline"):
            conn_state = "failed"

        connections.append({
            "id": f"conn-{dep.deployment_id}",
            "deployment_id": dep.deployment_id,
            "from_label": dep.input_source or f"Device #{dep.device_id or 'host'}",
            "to_label": dep.output_destination or "Processing Output",
            "state": conn_state,
        })

    return success_response(data={
        "deployments": [_serialize_deployment(d) for d in deployments],
        "runtime_agents": runtime_agents,
        "connections": connections,
    })


@router.post("/deployments", dependencies=[Depends(verify_api_key)])
def create_deployment(payload: DeploymentCreateRequest, db: Session = Depends(get_db)):
    """Deploy an existing AI model as an agent instance on an available airport device."""
    model = next((m for m in AI_MODULES if m["id"] == payload.model_id), None)
    if not model:
        return error_response(code="MODEL_NOT_FOUND", message=f"AI model '{payload.model_id}' does not exist.", status_code=404)

    compat = MODEL_COMPATIBILITY.get(payload.model_id, {})
    device_label = None
    location = payload.location

    if payload.device_id is not None:
        equip = db.query(Equipment).filter(Equipment.equipment_id == payload.device_id).first()
        if not equip:
            return error_response(code="DEVICE_NOT_FOUND", message=f"Device #{payload.device_id} not found.", status_code=404)
        if (equip.status or "").lower() in ("offline", "fault", "down", "maintenance"):
            return error_response(
                code="DEVICE_UNAVAILABLE",
                message=f"Device #{payload.device_id} ({equip.label}) is currently '{equip.status}' and cannot host a new agent.",
                status_code=400,
            )
        allowed_types = compat.get("compatible_device_types", [])
        if equip.equipment_type and allowed_types and equip.equipment_type.lower() not in allowed_types:
            return error_response(
                code="INCOMPATIBLE_DEVICE",
                message=f"Device type '{equip.equipment_type}' is not compatible with model '{model['name']}' (requires: {', '.join(allowed_types)}).",
                status_code=400,
            )
        device_label = equip.label or equip.serial_number or f"Device #{equip.equipment_id}"
        if not location:
            cam = db.query(Camera).filter(Camera.equipment_id == equip.equipment_id).first()
            zone = db.query(Zone).filter(Zone.zone_id == equip.zone_id).first() if equip.zone_id else None
            location = (cam.location if cam else None) or (zone.name if zone else None)

    probe = _probe_model_health(model)
    status = "running" if probe["reachable"] else "failed"
    proc_status = "ready" if probe["reachable"] else "halted"

    dep = AgentDeployment(
        deployment_id=f"dep-{uuid.uuid4().hex[:10]}",
        agent_name=payload.agent_name.strip(),
        agent_type=compat.get("agent_type", model["name"]),
        model_id=model["id"],
        model_name=model["name"],
        device_id=payload.device_id,
        device_label=device_label,
        location=location,
        input_source=payload.input_source or (f"{device_label} ({compat.get('default_input', 'Input')})" if device_label else compat.get("default_input")),
        output_destination=payload.output_destination or compat.get("default_output"),
        status=status,
        processing_status=proc_status,
        health_url=probe["health_url"],
        config_json=json.dumps(payload.config or {}),
        last_error=probe["error"],
        last_heartbeat=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(dep)
    db.flush()

    if not probe["reachable"]:
        _emit_notification(
            db,
            deployment=dep,
            agent_name=dep.agent_name,
            model_name=dep.model_name,
            device_id=dep.device_id,
            device_label=dep.device_label,
            severity="critical",
            event_kind="model_init_failed",
            description=f"Deployed '{dep.agent_name}', but AI service failed health check: {probe['error']}",
            agent_status=status,
            recommended_action="Start the AI microservice or click Repair after verifying service health.",
            dedupe_open=False,
        )
    else:
        _emit_notification(
            db,
            deployment=dep,
            agent_name=dep.agent_name,
            model_name=dep.model_name,
            device_id=dep.device_id,
            device_label=dep.device_label,
            severity="info",
            event_kind="recovered",
            description=f"Agent '{dep.agent_name}' deployed on {device_label or 'Host'} using {dep.model_name}.",
            agent_status=status,
            dedupe_open=False,
        )

    db.commit()
    db.refresh(dep)
    return success_response(data=_serialize_deployment(dep))


@router.post("/deployments/{deployment_id}/stop", dependencies=[Depends(verify_api_key)])
def stop_deployment(deployment_id: str, db: Session = Depends(get_db)):
    dep = db.query(AgentDeployment).filter(AgentDeployment.deployment_id == deployment_id).first()
    if not dep:
        return error_response(code="DEPLOYMENT_NOT_FOUND", message="Agent deployment not found", status_code=404)

    dep.status = "stopped"
    dep.processing_status = "halted"
    dep.updated_at = datetime.utcnow()
    _emit_notification(
        db,
        deployment=dep,
        agent_name=dep.agent_name,
        model_name=dep.model_name,
        device_id=dep.device_id,
        device_label=dep.device_label,
        severity="warning",
        event_kind="stalled",
        description=f"Agent '{dep.agent_name}' was stopped by administrator.",
        agent_status="stopped",
        recommended_action="Click Restart when ready to resume processing.",
        dedupe_open=False,
    )
    db.commit()
    return success_response(data=_serialize_deployment(dep))


@router.post("/deployments/{deployment_id}/restart", dependencies=[Depends(verify_api_key)])
def restart_deployment(deployment_id: str, db: Session = Depends(get_db)):
    dep = db.query(AgentDeployment).filter(AgentDeployment.deployment_id == deployment_id).first()
    if not dep:
        return error_response(code="DEPLOYMENT_NOT_FOUND", message="Agent deployment not found", status_code=404)

    model = next((m for m in AI_MODULES if m["id"] == dep.model_id), None)
    if not model:
        dep.status = "failed"
        dep.processing_status = "halted"
        dep.last_error = f"Model '{dep.model_id}' missing from AI registry."
        db.commit()
        return error_response(code="MODEL_NOT_FOUND", message=dep.last_error, status_code=400)

    if dep.device_id is not None:
        equip = db.query(Equipment).filter(Equipment.equipment_id == dep.device_id).first()
        if not equip or (equip.status or "").lower() in ("offline", "fault", "down", "maintenance"):
            dep.status = "offline"
            dep.processing_status = "disconnected"
            dep.last_error = "Assigned device is unavailable or offline."
            db.commit()
            return error_response(code="DEVICE_UNAVAILABLE", message=dep.last_error, status_code=400)

    probe = _probe_model_health(model)
    if not probe["reachable"]:
        dep.status = "failed"
        dep.processing_status = "halted"
        dep.last_error = probe["error"]
        _emit_notification(
            db,
            deployment=dep,
            agent_name=dep.agent_name,
            model_name=dep.model_name,
            device_id=dep.device_id,
            device_label=dep.device_label,
            severity="critical",
            event_kind="crash",
            description=f"Restart failed for '{dep.agent_name}': {probe['error']}",
            agent_status="failed",
            recommended_action="Check the AI microservice container or redeploy to another device.",
        )
        db.commit()
        return success_response(data=_serialize_deployment(dep))

    dep.status = "running"
    dep.processing_status = "ready"
    dep.last_error = None
    dep.last_heartbeat = datetime.utcnow()
    dep.updated_at = datetime.utcnow()
    _emit_notification(
        db,
        deployment=dep,
        agent_name=dep.agent_name,
        model_name=dep.model_name,
        device_id=dep.device_id,
        device_label=dep.device_label,
        severity="info",
        event_kind="recovered",
        description=f"Agent '{dep.agent_name}' restarted and is running.",
        agent_status="running",
        dedupe_open=False,
    )
    db.commit()
    return success_response(data=_serialize_deployment(dep))


@router.post("/deployments/{deployment_id}/repair", dependencies=[Depends(verify_api_key)])
def repair_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """Diagnose issues and attempt supported recovery actions."""
    dep = db.query(AgentDeployment).filter(AgentDeployment.deployment_id == deployment_id).first()
    if not dep:
        return error_response(code="DEPLOYMENT_NOT_FOUND", message="Agent deployment not found", status_code=404)

    issues: List[str] = []
    if dep.device_id is not None:
        equip = db.query(Equipment).filter(Equipment.equipment_id == dep.device_id).first()
        if not equip:
            issues.append(f"Assigned device #{dep.device_id} no longer exists in database.")
        elif (equip.status or "").lower() in ("offline", "fault", "down", "maintenance"):
            issues.append(f"Device '{equip.label}' is '{equip.status}'.")

    model = next((m for m in AI_MODULES if m["id"] == dep.model_id), None)
    if not model:
        issues.append(f"Model '{dep.model_id}' not found in AI registry.")
    else:
        probe = _probe_model_health(model)
        if not probe["reachable"]:
            issues.append(f"AI service health check failed: {probe['error']}")

    if issues:
        dep.status = "failed"
        dep.processing_status = "halted"
        dep.last_error = " | ".join(issues)
        _emit_notification(
            db,
            deployment=dep,
            agent_name=dep.agent_name,
            model_name=dep.model_name,
            device_id=dep.device_id,
            device_label=dep.device_label,
            severity="critical",
            event_kind="operational_issue",
            description=f"Automatic repair requires manual intervention: {dep.last_error}",
            agent_status="failed",
            recommended_action="Restore the device/AI service or duplicate this agent onto a healthy device.",
            dedupe_open=False,
        )
        db.commit()
        return success_response(data={
            "repaired": False,
            "manual_intervention_required": True,
            "issues": issues,
            "deployment": _serialize_deployment(dep),
        })

    dep.status = "running"
    dep.processing_status = "ready"
    dep.last_error = None
    dep.last_heartbeat = datetime.utcnow()
    dep.updated_at = datetime.utcnow()
    _emit_notification(
        db,
        deployment=dep,
        agent_name=dep.agent_name,
        model_name=dep.model_name,
        device_id=dep.device_id,
        device_label=dep.device_label,
        severity="info",
        event_kind="recovered",
        description=f"Agent '{dep.agent_name}' repaired and verified healthy.",
        agent_status="running",
        dedupe_open=False,
    )
    db.commit()
    return success_response(data={
        "repaired": True,
        "manual_intervention_required": False,
        "issues": [],
        "deployment": _serialize_deployment(dep),
    })


@router.post("/deployments/{deployment_id}/duplicate", dependencies=[Depends(verify_api_key)])
def duplicate_deployment(deployment_id: str, payload: DuplicateDeploymentRequest, db: Session = Depends(get_db)):
    """Deploy a copy of an existing agent configuration onto another available device."""
    src = db.query(AgentDeployment).filter(AgentDeployment.deployment_id == deployment_id).first()
    if not src:
        return error_response(code="DEPLOYMENT_NOT_FOUND", message="Source agent deployment not found", status_code=404)

    create_req = DeploymentCreateRequest(
        agent_name=payload.agent_name or f"{src.agent_name} (Device #{payload.device_id})",
        model_id=src.model_id,
        device_id=payload.device_id,
        location=payload.location,
        output_destination=src.output_destination,
        config=json.loads(src.config_json) if src.config_json else {},
    )
    return create_deployment(create_req, db)


@router.delete("/deployments/{deployment_id}", dependencies=[Depends(verify_api_key)])
def remove_deployment(deployment_id: str, db: Session = Depends(get_db)):
    """Remove an agent deployment instance without deleting the underlying AI model."""
    dep = db.query(AgentDeployment).filter(AgentDeployment.deployment_id == deployment_id).first()
    if not dep:
        return error_response(code="DEPLOYMENT_NOT_FOUND", message="Agent deployment not found", status_code=404)
    db.delete(dep)
    db.commit()
    return success_response(data={"deployment_id": deployment_id, "removed": True})


@router.get("/notifications", dependencies=[Depends(verify_api_key)])
def list_notifications(
    severity: Optional[str] = Query(None),
    agent_name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    sync: bool = Query(True),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """List AI agent operational notifications with optional live health sync."""
    if sync:
        _sync_deployments_health(db)

    q = db.query(AgentNotification)
    if severity:
        q = q.filter(AgentNotification.severity == severity.lower())
    if agent_name:
        q = q.filter(AgentNotification.agent_name == agent_name)
    if status:
        q = q.filter(AgentNotification.status == status.lower())
    if unread_only:
        q = q.filter(AgentNotification.is_read == False)  # noqa: E712

    rows = q.order_by(AgentNotification.created_at.desc()).limit(limit).all()
    all_agents = sorted({r[0] for r in db.query(AgentNotification.agent_name).distinct().all() if r[0]})
    unread_count = db.query(AgentNotification).filter(AgentNotification.is_read == False).count()  # noqa: E712

    return success_response(data={
        "notifications": [_serialize_notification(n) for n in rows],
        "agents": all_agents,
        "unread_count": unread_count,
    })


@router.post("/notifications/{notification_id}/read", dependencies=[Depends(verify_api_key)])
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    n = db.query(AgentNotification).filter(AgentNotification.notification_id == notification_id).first()
    if not n:
        return error_response(code="NOTIFICATION_NOT_FOUND", message="Notification not found", status_code=404)
    n.is_read = True
    db.commit()
    return success_response(data=_serialize_notification(n))


@router.post("/notifications/{notification_id}/acknowledge", dependencies=[Depends(verify_api_key)])
def acknowledge_notification(notification_id: str, db: Session = Depends(get_db)):
    n = db.query(AgentNotification).filter(AgentNotification.notification_id == notification_id).first()
    if not n:
        return error_response(code="NOTIFICATION_NOT_FOUND", message="Notification not found", status_code=404)
    n.is_read = True
    n.status = "acknowledged"
    n.acknowledged_at = datetime.utcnow()
    db.commit()
    return success_response(data=_serialize_notification(n))


@router.post("/notifications/{notification_id}/resolve", dependencies=[Depends(verify_api_key)])
def resolve_notification(notification_id: str, db: Session = Depends(get_db)):
    n = db.query(AgentNotification).filter(AgentNotification.notification_id == notification_id).first()
    if not n:
        return error_response(code="NOTIFICATION_NOT_FOUND", message="Notification not found", status_code=404)
    n.is_read = True
    n.status = "resolved"
    n.resolved_at = datetime.utcnow()
    db.commit()
    return success_response(data=_serialize_notification(n))


@router.post("/notifications/mark-all-read", dependencies=[Depends(verify_api_key)])
def mark_all_notifications_read(db: Session = Depends(get_db)):
    db.query(AgentNotification).filter(AgentNotification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()
    return success_response(data={"marked_all_read": True})
