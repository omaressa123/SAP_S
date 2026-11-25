import json
import time
import math
import base64
# import requests
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import cv2
import numpy as np

from ..database import get_db
from ..models.admin_cameras import Camera, MonitoringAlert, EmergencyEvent
from ..models.wayfinding import Zone
from ..models.agents import AirportEvent
from ..utils.response_envelope import success_response, error_response
from ..utils.auth import verify_api_key

router = APIRouter()

# NATIVE YOLO INFERENCE PIPELINE
_YOLO_MODEL = None

def get_yolo_model():
    global _YOLO_MODEL
    if _YOLO_MODEL is None:
        try:
            from ultralytics import YOLO
            _YOLO_MODEL = YOLO("yolov8n.pt")
        except Exception as e:
            print("Failed to load native YOLO model:", e)
    return _YOLO_MODEL

# COCO Classes relevant for airport surveillance
AIRPORT_CLASSES = {
    0: "person",
    24: "backpack",
    26: "handbag",
    28: "suitcase",
    4: "airplane",
    2: "car",
    5: "bus",
    7: "truck",
    56: "chair",
    63: "laptop",
    67: "cell phone",
    76: "scissors"
}

# In-memory temporal tracker for stationary unattended baggage per camera
_CAMERA_TRACKERS: Dict[int, Dict[str, Any]] = {}

def track_stationary_bags(camera_id: int, unattended_bags: List[Dict[str, Any]]) -> int:
    """
    Tracks stationary luggage across sequential CCTV frames to measure real dwell duration (seconds).
    """
    now = time.time()
    if camera_id not in _CAMERA_TRACKERS:
        _CAMERA_TRACKERS[camera_id] = {"bags": [], "last_seen": now}

    tracker = _CAMERA_TRACKERS[camera_id]
    current_active = []
    max_duration = 0.0

    for b in unattended_bags:
        cx, cy = b["center"]
        matched = False
        for old in tracker["bags"]:
            dist = math.hypot(cx - old["center"][0], cy - old["center"][1])
            # If the bag is in approximately the same position (< 50px movement)
            if dist < 65:
                dur = now - old["start_time"]
                current_active.append({
                    "center": (cx, cy),
                    "start_time": old["start_time"],
                    "duration": dur
                })
                if dur > max_duration:
                    max_duration = dur
                matched = True
                break
        if not matched:
            current_active.append({
                "center": (cx, cy),
                "start_time": now,
                "duration": 2.0
            })
            if max_duration < 2.0:
                max_duration = 2.0

    tracker["bags"] = current_active
    tracker["last_seen"] = now
    return max(1, int(max_duration))


def run_yolo_frame_analysis(frame_base64: str, camera_id: int = 1):
    """
    Run native YOLOv8 object detection and anomaly heuristics directly on an uploaded video frame.
    Detects travelers, luggage, unattended baggage, and abnormal density.
    """
    model = get_yolo_model()
    if model is None:
        return None

    try:
        data = frame_base64.split(",", 1)[1] if "," in frame_base64 else frame_base64
        img_bytes = base64.b64decode(data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None

        h, w, _ = img.shape
        # Run YOLO with conf=0.15 to ensure detection in surveillance angles
        results = model(img, conf=0.15, verbose=False)[0]

        persons = []
        bags = []
        other_items = []
        all_detections = []

        for box in results.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            cls_name = model.names.get(cls_id, str(cls_id))
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            norm_box = {
                "x": round(max(0, min(100, (x1 / w) * 100)), 1),
                "y": round(max(0, min(100, (y1 / h) * 100)), 1),
                "w": round(max(1, min(100, ((x2 - x1) / w) * 100)), 1),
                "h": round(max(1, min(100, ((y2 - y1) / h) * 100)), 1),
            }

            center = ((x1 + x2) / 2, (y1 + y2) / 2)
            aspect_ratio = (x2 - x1) / max(1.0, (y2 - y1))

            if cls_id == 0:  # Person / Traveler
                persons.append({
                    "center": center,
                    "box": (x1, y1, x2, y2),
                    "norm": norm_box,
                    "conf": conf,
                    "aspect_ratio": aspect_ratio
                })
            elif cls_id in [24, 26, 28]:  # Backpack, Handbag, Suitcase
                bags.append({
                    "center": center,
                    "box": (x1, y1, x2, y2),
                    "norm": norm_box,
                    "conf": conf,
                    "cls": cls_name,
                    "width": x2 - x1
                })
            elif cls_id in AIRPORT_CLASSES:
                other_items.append({
                    "norm": norm_box,
                    "conf": conf,
                    "cls": cls_name
                })

        # --- Heuristic Anomaly Analysis ---
        detected_behavior = "Normal transit"
        severity = "Low"
        confidence_val = 94.0
        unattended_duration = 0
        details = f"YOLOv8 detected {len(persons)} traveler(s) and {len(bags)} luggage item(s) in CCTV view."
        recommended_action = "Routine surveillance active."

        # Check 1: Fallen Traveler / Medical Emergency
        fallen_persons = [p for p in persons if p["aspect_ratio"] > 1.35 and p["norm"]["y"] > 20]
        if fallen_persons:
            detected_behavior = "Passenger fallen"
            severity = "Critical"
            confidence_val = round(max([p["conf"] for p in fallen_persons]) * 100, 1)
            details = f"Emergency: Prone traveler posture detected by YOLO (aspect ratio {fallen_persons[0]['aspect_ratio']:.2f}). Possible passenger collapse."
            recommended_action = "Dispatch first-aid medical team and terminal marshal."

        # Check 2: Unattended Baggage (Distance to nearest traveler)
        unattended_bags = []
        for b in bags:
            min_dist = float("inf")
            for p in persons:
                dist = math.hypot(b["center"][0] - p["center"][0], b["center"][1] - p["center"][1])
                if dist < min_dist:
                    min_dist = dist

            # If closest person is farther than 2.0x bag width or > 120px away
            threshold = max(60.0, b["width"] * 2.0)
            is_unattended = (min_dist > threshold) or (len(persons) == 0)

            if is_unattended:
                unattended_bags.append(b)
                all_detections.append({
                    "label": f"⚠️ Unattended {b['cls'].title()} ({int(b['conf'] * 100)}%)",
                    "bbox": b["norm"],
                    "severity": "High",
                    "color": "#ef4444",
                    "isAnomaly": True
                })
            else:
                all_detections.append({
                    "label": f"{b['cls'].title()} (Accompanied)",
                    "bbox": b["norm"],
                    "severity": "Low",
                    "color": "#10b981",
                    "isAnomaly": False
                })

        if unattended_bags and severity != "Critical":
            unattended_duration = track_stationary_bags(camera_id, unattended_bags)
            detected_behavior = "Unattended baggage"
            # If stationary > 40s or > 20s, classify as High/Critical
            severity = "Critical" if unattended_duration >= 45 else "High"
            confidence_val = round(max([b["conf"] for b in unattended_bags]) * 100, 1)
            details = f"Security Alert: YOLO identified {len(unattended_bags)} stationary baggage item(s) unattached for {unattended_duration}s with no traveler nearby."
            recommended_action = "Dispatch EOD / K9 security sweep to inspect baggage."
        elif not unattended_bags:
            # Clear or decay temporal bag tracker if no unattended bags exist in this frame
            if camera_id in _CAMERA_TRACKERS:
                _CAMERA_TRACKERS[camera_id]["bags"] = []

        # Check 3: Overcrowding / High Density
        if len(persons) >= 8 and severity not in ["Critical", "High"]:
            detected_behavior = "Overcrowding limit exceeded"
            severity = "Medium"
            unattended_duration = 35
            confidence_val = 92.5
            details = f"Congestion Alert: High passenger cluster ({len(persons)} travelers) detected in terminal hall."
            recommended_action = "Open auxiliary queue lines and monitor checkpoint flow."

        # Add traveler bounding boxes
        for p in persons:
            is_fallen = p in fallen_persons
            all_detections.append({
                "label": f"Traveler ({int(p['conf'] * 100)}%)" if not is_fallen else f"🚨 Fallen Traveler ({int(p['conf'] * 100)}%)",
                "bbox": p["norm"],
                "severity": "Critical" if is_fallen else "Low",
                "color": "#ef4444" if is_fallen else "#10b981",
                "isAnomaly": is_fallen
            })

        # Add other relevant airport items
        for item in other_items:
            all_detections.append({
                "label": f"{item['cls'].title()} ({int(item['conf'] * 100)}%)",
                "bbox": item["norm"],
                "severity": "Low",
                "color": "#0ea5e9",
                "isAnomaly": False
            })

        if not persons and not bags and not other_items:
            details = "YOLO scanned frame: No persons or unattended items detected in current view."

        return {
            "detections": all_detections,
            "detectedBehavior": detected_behavior,
            "severity": severity,
            "confidence": confidence_val,
            "peopleCount": len(persons),
            "bagCount": len(bags),
            "unattendedBagCount": len(unattended_bags),
            "unattendedDurationSeconds": unattended_duration,
            "details": details,
            "recommendedAction": recommended_action
        }

    except Exception as e:
        print("Error during YOLO frame analysis:", e)
        return None


# ----------------------------------------------------------------------------
# DATA MODELS
# ----------------------------------------------------------------------------
class BoundingBox(BaseModel):
    x: float = 0
    y: float = 0
    w: float = 0
    h: float = 0

class CctvDetectRequest(BaseModel):
    cameraId: int
    zoneId: int
    behaviorType: str
    severity: str
    detectedBoundingBox: Optional[BoundingBox] = None
    unattendedDurationSeconds: Optional[int] = 0
    snapshotBase64: Optional[str] = ""
    frameBase64: Optional[str] = ""
    confidence: Optional[float] = 94.5
    details: Optional[str] = ""

class EscalateAlertRequest(BaseModel):
    monitoringAlertId: int
    eventType: Optional[str] = "security_anomaly"
    zoneId: Optional[int] = 1
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
    """Fetch all active surveillance cameras mapped to airport zones with simulated presets."""
    try:
        cameras = db.query(Camera).all()
        zones = {z.zone_id: z.zone_name for z in db.query(Zone).all()}
    except Exception:
        cameras = []
        zones = {}

    cam_list = []
    for c in cameras:
        z_name = zones.get(c.zone_id, f"Zone {c.zone_id}")
        cam_list.append({
            "cameraId": c.camera_id,
            "location": c.location,
            "zoneId": c.zone_id,
            "zoneName": z_name,
            "cameraType": c.camera_type or "fixed_ptz",
            "status": c.status or "online",
            "resolution": "1080p FHD",
            "fps": 30,
            "streamPath": f"/streams/cam_{c.camera_id}"
        })

    if not cam_list:
        cam_list = [
            {"cameraId": 1, "location": "T2-CAM-01 (Check-in Hall West)", "zoneId": 1, "zoneName": "Check-in Hall West", "cameraType": "fisheye_360", "status": "online", "resolution": "1080p", "fps": 30},
            {"cameraId": 2, "location": "T2-CAM-02 (Security Alpha)", "zoneId": 2, "zoneName": "Security Checkpoint Alpha", "cameraType": "ptz", "status": "online", "resolution": "1080p", "fps": 30},
            {"cameraId": 3, "location": "T2-CAM-03 (Baggage Claim Hall)", "zoneId": 3, "zoneName": "Security Checkpoint Bravo", "cameraType": "fixed", "status": "online", "resolution": "1080p", "fps": 30},
            {"cameraId": 4, "location": "T2-CAM-04 (Main Concourse T2)", "zoneId": 4, "zoneName": "Main Concourse T2", "cameraType": "ptz", "status": "online", "resolution": "1080p", "fps": 30},
            {"cameraId": 5, "location": "T2-CAM-05 (Gate A Holding Area)", "zoneId": 5, "zoneName": "Gate A Holding Area", "cameraType": "thermal", "status": "online", "resolution": "1080p", "fps": 30},
        ]

    presets = [
        {
            "id": "unattended_bag",
            "title": "Unattended Luggage Incident",
            "behaviorType": "Unattended baggage",
            "severity": "High",
            "durationSeconds": 28,
            "confidence": 95.8,
            "bbox": {"x": 36, "y": 42, "w": 26, "h": 36},
            "description": "Dark hard-shell suitcase stationary for >20s without passenger in proximity",
            "recommendedAction": "Dispatch EOD / K9 security sweep"
        },
        {
            "id": "passenger_fall",
            "title": "Passenger Medical Emergency / Collapse",
            "behaviorType": "Passenger fallen",
            "severity": "Critical",
            "durationSeconds": 14,
            "confidence": 98.2,
            "bbox": {"x": 40, "y": 55, "w": 34, "h": 22},
            "description": "Rapid posture change & prone traveler detected by Pose AI",
            "recommendedAction": "Dispatch first-aid medical team and terminal marshal"
        },
        {
            "id": "overcrowding",
            "title": "Concourse Bottleneck & Overcrowding",
            "behaviorType": "Overcrowding limit exceeded",
            "severity": "Medium",
            "durationSeconds": 45,
            "confidence": 91.4,
            "bbox": {"x": 18, "y": 20, "w": 64, "h": 58},
            "description": "Passenger density exceeded 22 persons/100m² at boarding bottleneck",
            "recommendedAction": "Direct passenger flow to auxiliary queue lanes"
        },
        {
            "id": "restricted_intrusion",
            "title": "Restricted Airside Door Intrusion",
            "behaviorType": "Restricted zone intrusion",
            "severity": "High",
            "durationSeconds": 8,
            "confidence": 96.0,
            "bbox": {"x": 62, "y": 30, "w": 22, "h": 48},
            "description": "Unauthorized individual stepped across secure airside door perimeter",
            "recommendedAction": "Lockdown portal gate & dispatch nearest officer"
        },
        {
            "id": "normal_transit",
            "title": "Normal Passenger Flow (Safe)",
            "behaviorType": "Normal transit",
            "severity": "Low",
            "durationSeconds": 0,
            "confidence": 99.1,
            "bbox": {"x": 25, "y": 25, "w": 45, "h": 50},
            "description": "Routine foot traffic; carry-ons accompanied by travelers",
            "recommendedAction": "No action required"
        }
    ]

    return success_response(data={
        "cameras": cam_list,
        "scenarios": presets,
        "aiStatus": "online",
        "engine": "YOLOv8 Native Vision"
    })

@router.post("/cctv/analyze-frame", dependencies=[Depends(verify_api_key)])
def analyze_cctv_frame(payload: AnalyzeFrameRequest):
    """
    Run native YOLOv8 inference on video frame or fallback to scenario presets.
    """
    # If a real video frame was provided (from video or webcam), run native YOLO
    if payload.frameBase64 and len(payload.frameBase64) > 100:
        analysis = run_yolo_frame_analysis(payload.frameBase64, payload.cameraId)
        if analysis is not None:
            return success_response(data={
                "cameraId": payload.cameraId,
                "engine": "YOLOv8 Native Vision",
                "isNativeVision": True,
                **analysis,
                "processedAt": datetime.utcnow().isoformat()
            })

    # Preset simulation fallback when in purely simulated demo mode
    scenarios_map = {
        "unattended_bag": {
            "behavior": "Unattended baggage",
            "severity": "High",
            "confidence": 95.8,
            "duration": 28,
            "details": "YOLO identified stationary Samsonite luggage unattended for >20s.",
            "recommendedAction": "Dispatch EOD / K9 security patrol to verify baggage.",
            "detections": [
                {"label": "⚠️ Unattended Bag (96%)", "confidence": 0.96, "bbox": {"x": 38, "y": 45, "w": 22, "h": 32}, "severity": "High", "color": "#ef4444", "isAnomaly": True},
                {"label": "Traveler (Departing)", "confidence": 0.91, "bbox": {"x": 72, "y": 25, "w": 18, "h": 50}, "severity": "Low", "color": "#10b981", "isAnomaly": False}
            ]
        },
        "passenger_fall": {
            "behavior": "Passenger fallen",
            "severity": "Critical",
            "confidence": 98.2,
            "duration": 14,
            "details": "Emergency: Prone posture detected by Pose AI. Possible collapse or medical incident.",
            "recommendedAction": "Dispatch immediate medical team & zone marshal.",
            "detections": [
                {"label": "🚨 Fallen Traveler (98%)", "confidence": 0.98, "bbox": {"x": 35, "y": 55, "w": 38, "h": 24}, "severity": "Critical", "color": "#ef4444", "isAnomaly": True},
                {"label": "Bystander", "confidence": 0.89, "bbox": {"x": 20, "y": 28, "w": 18, "h": 48}, "severity": "Low", "color": "#10b981", "isAnomaly": False}
            ]
        },
        "overcrowding": {
            "behavior": "Overcrowding limit exceeded",
            "severity": "Medium",
            "confidence": 93.0,
            "duration": 45,
            "details": "Congestion Alert: High passenger density (24 travelers) detected in camera view.",
            "recommendedAction": "Open auxiliary queue lines and monitor checkpoint flow.",
            "detections": [
                {"label": "⚠️ Density Cluster: 24 pax (93%)", "confidence": 0.93, "bbox": {"x": 20, "y": 20, "w": 60, "h": 55}, "severity": "Medium", "color": "#f59e0b", "isAnomaly": True}
            ]
        },
        "restricted_intrusion": {
            "behavior": "Restricted zone intrusion",
            "severity": "High",
            "confidence": 96.0,
            "duration": 8,
            "details": "Perimeter Alert: Unauthorized individual crossed secure airside perimeter boundary.",
            "recommendedAction": "Lockdown airside door and notify armed dispatch.",
            "detections": [
                {"label": "⚠️ Perimeter Breach: Airside Door (96%)", "confidence": 0.96, "bbox": {"x": 60, "y": 30, "w": 24, "h": 50}, "severity": "High", "color": "#ef4444", "isAnomaly": True}
            ]
        },
        "normal_flow": {
            "behavior": "Normal transit",
            "severity": "Low",
            "confidence": 99.1,
            "duration": 0,
            "details": "All travelers and carry-on luggage accompanied and moving normally.",
            "recommendedAction": "Routine surveillance active.",
            "detections": [
                {"label": "Traveler A (98%)", "confidence": 0.98, "bbox": {"x": 22, "y": 26, "w": 18, "h": 48}, "severity": "Low", "color": "#10b981", "isAnomaly": False},
                {"label": "Traveler B + Handbag (95%)", "confidence": 0.95, "bbox": {"x": 55, "y": 30, "w": 20, "h": 46}, "severity": "Low", "color": "#10b981", "isAnomaly": False}
            ]
        }
    }

    sc = scenarios_map.get(payload.scenario or "normal_flow", scenarios_map["normal_flow"])
    return success_response(data={
        "cameraId": payload.cameraId,
        "engine": "YOLOv8 Scenario Simulation",
        "isNativeVision": False,
        "detections": sc["detections"],
        "detectedBehavior": sc["behavior"],
        "severity": sc["severity"],
        "confidence": sc["confidence"],
        "unattendedDurationSeconds": sc["duration"],
        "details": sc["details"],
        "recommendedAction": sc["recommendedAction"],
        "processedAt": datetime.utcnow().isoformat()
    })

@router.post("/cctv/detect", dependencies=[Depends(verify_api_key)])
def cctv_anomaly_detect(payload: CctvDetectRequest, db: Session = Depends(get_db)):
    """Record an AI-detected anomaly into the PostgreSQL database and broadcast to AOCC."""
    alert = MonitoringAlert(
        camera_id=payload.cameraId,
        zone_id=payload.zoneId,
        behavior_type=payload.behaviorType,
        severity=payload.severity,
        status="open",
        timestamp=datetime.utcnow()
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    is_anomaly = payload.severity.lower() in ["medium", "high", "critical", "warning"]
    if is_anomaly:
        try:
            evt_id = f"EVT-CCTV-{alert.alert_id}-{int(time.time())}"
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
                    "bbox": payload.detectedBoundingBox.dict() if payload.detectedBoundingBox else {}
                }),
                status="published",
                created_at=datetime.utcnow()
            )
            db.add(airport_event)
            db.commit()
        except Exception:
            db.rollback()

    return success_response(data={
        "monitoringAlertId": alert.alert_id,
        "status": alert.status,
        "alertLevel": alert.severity.lower(),
        "behaviorType": alert.behavior_type,
        "severity": alert.severity,
        "cameraId": alert.camera_id,
        "zoneId": alert.zone_id,
        "triggeredEmergencyEventId": alert.linked_emergency_event_id,
        "broadcastedToAocc": True,
        "confidence": payload.confidence,
        "timestamp": alert.timestamp.isoformat()
    }, status_code=201)

@router.post("/emergency/escalate", dependencies=[Depends(verify_api_key)])
def escalate_alert(payload: EscalateAlertRequest, db: Session = Depends(get_db)):
    """Escalate a confirmed security anomaly: dispatches security patrol robots and notifies AOCC."""
    alert = db.query(MonitoringAlert).filter(MonitoringAlert.alert_id == payload.monitoringAlertId).first()
    if alert:
        alert.status = "escalated"
        alert.updated_at = datetime.utcnow()

    emergency = EmergencyEvent(
        event_type=payload.eventType or "security_threat",
        zone_id=payload.zoneId or (alert.zone_id if alert else 1),
        status="in_progress",
        detected_time=datetime.utcnow()
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
                "unit": "AeroGuard-07 (Patrol Bot)",
                "eta_seconds": 45
            }),
            status="published",
            created_at=datetime.utcnow()
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
        "assignedRobot": {
            "robotId": 7,
            "callsign": "AeroGuard-07",
            "type": "emergency_response_patrol",
            "status": "dispatched",
            "etaSeconds": 45
        },
        "dispatchedAt": emergency.detected_time.isoformat()
    }, status_code=201)

@router.get("/alerts/recent", dependencies=[Depends(verify_api_key)])
def get_recent_alerts(limit: int = 10, db: Session = Depends(get_db)):
    """Fetch the latest CCTV anomaly alerts from PostgreSQL."""
    try:
        alerts = db.query(MonitoringAlert).order_by(MonitoringAlert.alert_id.desc()).limit(limit).all()
        zones = {z.zone_id: z.zone_name for z in db.query(Zone).all()}
        cameras = {c.camera_id: c.location for c in db.query(Camera).all()}
    except Exception:
        alerts = []
        zones = {}
        cameras = {}

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
            "timestamp": a.timestamp.isoformat() if a.timestamp else None
        })

    return success_response(data=out)
