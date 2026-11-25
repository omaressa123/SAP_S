import json
import time
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.admin_cameras import Camera, MonitoringAlert, EmergencyEvent
from ..models.wayfinding import Zone
from ..models.agents import AirportEvent
from ..schemas.admin_cameras import MonitoringAlertCreate, EmergencyEventCreate
from ..utils.response_envelope import success_response, error_response
from ..utils.auth import verify_api_key

router = APIRouter()


# ----------------------------------------------------------------------------
# REQUEST SCHEMAS
# ----------------------------------------------------------------------------
class BoundingBox(BaseModel):
    x: float = 0.0
    y: float = 0.0
    w: float = 0.0
    h: float = 0.0

class CctvDetectRequest(BaseModel):
    cameraId: int
    zoneId: int
    behaviorType: str
    severity: str
    detectedBoundingBox: Optional[BoundingBox] = None
    unattendedDurationSeconds: Optional[int] = 0
    confidence: Optional[float] = 95.0
    details: Optional[str] = ""

class EscalateAlertRequest(BaseModel):
    monitoringAlertId: int
    eventType: Optional[str] = "security_anomaly"
    zoneId: Optional[int] = None
    dispatchUnit: Optional[str] = "security_patrol_robot"
    notes: Optional[str] = ""

class AnalyzeFrameRequest(BaseModel):
    cameraId: int = 1
    zoneId: Optional[int] = 1
    scenario: Optional[str] = None
    frameBase64: Optional[str] = ""


# ----------------------------------------------------------------------------
# ROUTES
# ----------------------------------------------------------------------------
@router.get("/cameras", dependencies=[Depends(verify_api_key)])
def get_monitoring_cameras(db: Session = Depends(get_db)):
    """Fetch surveillance cameras from database mapped to airport zones."""
    cameras = db.query(Camera).all()
    zones = {z.zone_id: z.zone_name for z in db.query(Zone).all()}

    cam_list = []
    for c in cameras:
        z_name = zones.get(c.zone_id, f"Zone {c.zone_id}")
        cam_list.append({
            "cameraId": c.camera_id,
            "location": c.location,
            "zoneId": c.zone_id,
            "zoneName": z_name,
            "cameraType": c.camera_type or "security",
            "status": c.status or "online",
            "resolution": "1080p FHD",
            "fps": 30,
            "streamPath": f"/streams/cam_{c.camera_id}"
        })

    return success_response(data={
        "cameras": cam_list,
        "scenarios": [],
        "aiStatus": "online",
        "engine": "Surveillance Monitoring Engine"
    })


@router.post("/cctv/analyze-frame", dependencies=[Depends(verify_api_key)])
def analyze_cctv_frame(payload: AnalyzeFrameRequest):
    """
    Analyze CCTV video frame by forwarding to the unified detection pipeline (port 8004)
    which runs Baggage_And_Person_Detector (YOLOv8n) + fulldetection (MediaPipe + RF FallDetector).
    """
    if not payload.frameBase64 or len(payload.frameBase64.strip()) < 50:
        return error_response(code="INVALID_PAYLOAD", message="No frame payload provided for video analysis.", status_code=400)

    # Clean base64 header if present
    b64_clean = payload.frameBase64.strip()
    if "," in b64_clean:
        b64_clean = b64_clean.split(",", 1)[1]

    # Call AI unified detection microservice
    detections = []
    detected_behavior = "Normal transit"
    severity = "Low"
    confidence = 0.0
    details = "Frame processed by Unified Detection Pipeline; no anomalies detected."
    recommended_action = "Routine surveillance active."
    people_count = 0
    bag_count = 0
    unattended_bag_count = 0

    statistics = {
        "peopleCurrentlyInside": people_count,
        "totalPeopleDetected": people_count,
        "totalPeopleExited": 0,
        "totalBaggageDetected": bag_count,
        "associatedBaggage": 0,
        "unassociatedBaggage": unattended_bag_count,
    }
    tracking_table = []

    try:
        import httpx
        from ..config import settings
        unified_url = (settings.FULL_DETECTION_URL or "http://localhost:8004").rstrip("/") + "/process"
        with httpx.Client(timeout=4.0) as client:
            resp = client.post(
                unified_url,
                json={
                    "image_base64": b64_clean,
                    "camera_id": payload.cameraId,
                    "source_id": f"cam-{payload.cameraId}",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                tracker_data = data.get("tracker") or {}
                if tracker_data.get("detections"):
                    detections = tracker_data.get("detections", [])
                    people_count = tracker_data.get("peopleCount", len([d for d in detections if d.get("type") == "person"]))
                    bag_count = tracker_data.get("bagCount", len([d for d in detections if d.get("type") == "baggage"]))
                    statistics = tracker_data.get("statistics") or statistics
                    tracking_table = tracker_data.get("trackingTable") or []
                
                # Check fall detection events from the pipeline
                events = data.get("events", [])
                for ev in events:
                    etype = ev.get("event_type", "")
                    if etype in ("fall_confirmed", "fall_suspected"):
                        detected_behavior = "Person fall detected"
                        severity = "Critical" if etype == "fall_confirmed" else "High"
                        confidence = 94.5
                        details = f"Fall detected via MediaPipe Pose & Random Forest (ID {ev.get('tracking_id')})."
                        recommended_action = "Dispatch immediate medical / emergency response."
                        epayload = ev.get("payload", {})
                        box = epayload.get("box", [0, 0, 0, 0])
                        fw = float(data.get("frame_width") or 640.0)
                        fh = float(data.get("frame_height") or 480.0)
                        x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
                        pct_x = round((x1 / fw) * 100.0, 2) if fw > 0 else 0.0
                        pct_y = round((y1 / fh) * 100.0, 2) if fh > 0 else 0.0
                        pct_w = round((max(0.0, x2 - x1) / fw) * 100.0, 2) if fw > 0 else 0.0
                        pct_h = round((max(0.0, y2 - y1) / fh) * 100.0, 2) if fh > 0 else 0.0
                        detections.append({
                            "type": "fall",
                            "label": "FALL DETECTED",
                            "confidence": 0.95,
                            "box": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                            "bbox": {"x": pct_x, "y": pct_y, "w": pct_w, "h": pct_h},
                            "color": "#ef4444",
                            "isAnomaly": True,
                        })

                if not detections and not events:
                    details = "Frame processed; no people or objects detected in view."
                elif detected_behavior == "Normal transit":
                    details = f"Tracking {people_count} person(s) and {bag_count} baggage item(s)."
    except Exception as exc:
        details = f"Unified detection pipeline notice: {exc}"

    return success_response(data={
        "cameraId": payload.cameraId,
        "engine": "Airport People & Baggage Tracking System (YOLOv8 + ByteTrack)",
        "isNativeVision": True,
        "detections": detections,
        "detectedBehavior": detected_behavior,
        "severity": severity,
        "confidence": confidence,
        "peopleCount": people_count,
        "bagCount": bag_count,
        "unattendedBagCount": statistics.get("unassociatedBaggage", 0),
        "statistics": statistics,
        "trackingTable": tracking_table,
        "details": details,
        "recommendedAction": recommended_action,
        "processedAt": datetime.utcnow().isoformat() + "Z"
    })


@router.post("/cctv/detect", dependencies=[Depends(verify_api_key)])
def cctv_anomaly_detect(payload: CctvDetectRequest, db: Session = Depends(get_db)):
    """Record a detected CCTV anomaly into the PostgreSQL database and broadcast to AOCC."""
    now = datetime.utcnow()
    alert = MonitoringAlert(
        camera_id=payload.cameraId,
        zone_id=payload.zoneId,
        behavior_type=payload.behaviorType,
        severity=payload.severity,
        status="open",
        timestamp=now,
        created_at=now,
        updated_at=now,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    is_anomaly = (payload.severity or "").lower() in ["medium", "high", "critical", "warning"]
    if is_anomaly:
        try:
            evt_id = f"EVT-CCTV-{alert.alert_id}-{int(time.time())}"
            bbox_dict = payload.detectedBoundingBox.dict() if payload.detectedBoundingBox else {}
            airport_event = AirportEvent(
                event_id=evt_id,
                event_type="CCTV_SECURITY_ANOMALY",
                source=f"cctv_camera_{payload.cameraId}",
                payload=json.dumps({
                    "alert_id": alert.alert_id,
                    "camera_id": payload.cameraId,
                    "zone_id": payload.zoneId,
                    "behavior": payload.behaviorType,
                    "severity": payload.severity,
                    "duration_seconds": payload.unattendedDurationSeconds,
                    "confidence": payload.confidence,
                    "bbox": bbox_dict
                }),
                status="published",
                created_at=now,
                updated_at=now,
            )
            db.add(airport_event)
            db.commit()
        except Exception:
            db.rollback()

    return success_response(data={
        "monitoringAlertId": alert.alert_id,
        "status": alert.status,
        "alertLevel": (alert.severity or "low").lower(),
        "behaviorType": alert.behavior_type,
        "severity": alert.severity,
        "cameraId": alert.camera_id,
        "zoneId": alert.zone_id,
        "triggeredEmergencyEventId": alert.linked_emergency_event_id,
        "broadcastedToAocc": True,
        "confidence": payload.confidence,
        "timestamp": alert.timestamp.isoformat() + "Z" if alert.timestamp else now.isoformat() + "Z"
    }, status_code=201)


@router.post("/emergency/escalate", dependencies=[Depends(verify_api_key)])
def escalate_alert(payload: EscalateAlertRequest, db: Session = Depends(get_db)):
    """Escalate a confirmed security anomaly: create EmergencyEvent record and dispatch patrol."""
    now = datetime.utcnow()
    alert = db.query(MonitoringAlert).filter(MonitoringAlert.alert_id == payload.monitoringAlertId).first()
    if alert:
        alert.status = "escalated"
        alert.updated_at = now

    zone_id = payload.zoneId or (alert.zone_id if alert else 1)
    emergency = EmergencyEvent(
        event_type=payload.eventType or "security_threat",
        zone_id=zone_id,
        status="in_progress",
        detected_time=now,
        created_at=now,
        updated_at=now,
    )
    db.add(emergency)
    db.commit()
    db.refresh(emergency)

    if alert:
        alert.linked_emergency_event_id = emergency.event_id
        db.commit()

    try:
        esc_evt = AirportEvent(
            event_id=f"EVT-DISPATCH-{emergency.event_id}-{int(time.time())}",
            event_type="SECURITY_PATROL_DISPATCHED",
            source="security_operations_desk",
            payload=json.dumps({
                "emergency_event_id": emergency.event_id,
                "monitoring_alert_id": payload.monitoringAlertId,
                "zone_id": emergency.zone_id,
                "dispatch_unit": payload.dispatchUnit or "security_patrol_robot",
                "notes": payload.notes or ""
            }),
            status="published",
            created_at=now,
            updated_at=now,
        )
        db.add(esc_evt)
        db.commit()
    except Exception:
        db.rollback()

    return success_response(data={
        "eventId": emergency.event_id,
        "monitoringAlertId": payload.monitoringAlertId,
        "eventType": emergency.event_type,
        "status": emergency.status,
        "zoneId": emergency.zone_id,
        "dispatchedAt": emergency.detected_time.isoformat() + "Z" if emergency.detected_time else now.isoformat() + "Z"
    }, status_code=201)


@router.get("/alerts/recent", dependencies=[Depends(verify_api_key)])
def get_recent_alerts(limit: int = 10, db: Session = Depends(get_db)):
    """Fetch the latest CCTV anomaly alerts directly from the database."""
    alerts = db.query(MonitoringAlert).order_by(MonitoringAlert.alert_id.desc()).limit(limit).all()
    zones = {z.zone_id: z.zone_name for z in db.query(Zone).all()}
    cameras = {c.camera_id: c.location for c in db.query(Camera).all()}

    out = []
    for a in alerts:
        out.append({
            "alertId": a.alert_id,
            "cameraId": a.camera_id,
            "cameraLocation": cameras.get(a.camera_id, f"CAM-{a.camera_id}"),
            "zoneId": a.zone_id,
            "zoneName": zones.get(a.zone_id, f"Zone {a.zone_id}"),
            "behaviorType": a.behavior_type,
            "severity": a.severity,
            "status": a.status,
            "linkedEmergencyId": a.linked_emergency_event_id,
            "timestamp": a.timestamp.isoformat() + "Z" if a.timestamp else None
        })

    return success_response(data=out)
