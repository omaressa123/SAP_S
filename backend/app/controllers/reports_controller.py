"""Reporting / analytics API layer.

Controller -> Service (inline aggregation) -> SQLAlchemy -> PostgreSQL.
All numbers come from the database. Empty DB => zeros + empty lists
(frontend renders honest empty states, never fake data).
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..utils.response_envelope import success_response
from ..models import identity as m_identity
from ..models import flights as m_flights
from ..models import check_in as m_checkin
from ..models import baggage_security_screening as m_bagsec
from ..models import security as m_security
from ..models import admin_cameras as m_admin
from ..models import devices as m_devices

router = APIRouter()


def _parse_dt(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return success_response(data={
        "passengers": db.query(func.count(m_identity.Passenger.passenger_id)).scalar() or 0,
        "flights": db.query(func.count(m_flights.Flight.flight_id)).scalar() or 0,
        "bags": db.query(func.count(m_checkin.Bag.bag_id)).scalar() or 0,
        "inspections": db.query(func.count(m_bagsec.BaggageInspection.inspection_id)).scalar() or 0,
        "face_verifications": db.query(func.count(m_identity.FaceVerificationLog.verification_id)).scalar() or 0,
        "open_alerts": db.query(func.count(m_admin.MonitoringAlert.alert_id)).filter(
            m_admin.MonitoringAlert.status == "open").scalar() or 0,
        "active_emergencies": db.query(func.count(m_admin.EmergencyEvent.event_id)).filter(
            m_admin.EmergencyEvent.status != "resolved").scalar() or 0,
        "devices": db.query(func.count(m_devices.Equipment.equipment_id)).scalar() or 0,
    })


@router.get("/passengers")
def passengers(
    db: Session = Depends(get_db),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    q = db.query(m_identity.Passenger)
    df, dt = _parse_dt(date_from), _parse_dt(date_to)
    if df:
        q = q.filter(m_identity.Passenger.created_at >= df)
    if dt:
        q = q.filter(m_identity.Passenger.created_at <= dt)
    total = q.count()
    by_nationality = (
        db.query(m_identity.Passenger.nationality_country_code, func.count("*"))
        .group_by(m_identity.Passenger.nationality_country_code).all()
    )
    verified = db.query(func.count(m_identity.FaceVerificationLog.verification_id)).filter(
        m_identity.FaceVerificationLog.verification_status == "verified").scalar() or 0
    failed = db.query(func.count(m_identity.FaceVerificationLog.verification_id)).filter(
        m_identity.FaceVerificationLog.verification_status == "failed").scalar() or 0
    checked_in = db.query(func.count(m_checkin.CheckInRecord.checkin_id)).scalar() or 0
    boarded = db.query(func.count(m_security.BoardingLog.boarding_id)).filter(
        m_security.BoardingLog.boarding_status == "boarded").scalar() or 0
    return success_response(data={
        "total": total,
        "by_nationality": [{"code": c, "count": n} for c, n in by_nationality],
        "verified": verified,
        "failed": failed,
        "checked_in": checked_in,
        "boarded": boarded,
    })


@router.get("/flights")
def flights_report(
    db: Session = Depends(get_db),
    status: str | None = Query(default=None),
    airline_id: int | None = Query(default=None),
):
    q = db.query(m_flights.Flight)
    if status:
        q = q.filter(m_flights.Flight.status == status)
    if airline_id:
        q = q.filter(m_flights.Flight.airline_id == airline_id)
    rows = q.all()
    dist: dict[str, int] = {}
    for f in rows:
        dist[getattr(f, "status", "unknown") or "unknown"] = dist.get(getattr(f, "status", "unknown") or "unknown", 0) + 1
    return success_response(data={
        "total": len(rows),
        "by_status": [{"status": k, "count": v} for k, v in dist.items()],
        "flights": [
            {"flight_id": f.flight_id, "flight_number": f.flight_number, "status": f.status,
             "scheduled_departure": str(f.scheduled_departure) if f.scheduled_departure else None}
            for f in rows[:200]
        ],
    })


@router.get("/baggage")
def baggage_report(
    db: Session = Depends(get_db),
    flight_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
):
    q = db.query(m_checkin.Bag)
    if status:
        q = q.filter(m_checkin.Bag.current_status == status)
    bags = q.all()
    by_status: dict[str, int] = {}
    for b in bags:
        s = getattr(b, "current_status", "unknown") or "unknown"
        by_status[s] = by_status.get(s, 0) + 1
    inspections = db.query(m_bagsec.BaggageInspection).order_by(
        m_bagsec.BaggageInspection.inspection_id.desc()).limit(200).all()
    by_result: dict[str, int] = {}
    for i in inspections:
        r = getattr(i, "result", "unknown") or "unknown"
        by_result[r] = by_result.get(r, 0) + 1
    detections = db.query(m_bagsec.DetectedItem).limit(500).all()
    return success_response(data={
        "total_bags": len(bags),
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "inspections_total": db.query(func.count(m_bagsec.BaggageInspection.inspection_id)).scalar() or 0,
        "by_result": [{"result": k, "count": v} for k, v in by_result.items()],
        "detected_items": [
            {"item_id": d.item_id, "inspection_id": d.inspection_id,
             "item_type": d.item_type, "confidence_score": float(d.confidence_score) if d.confidence_score is not None else None}
            for d in detections
        ],
        "recent_inspections": [
            {"inspection_id": i.inspection_id, "bag_id": i.bag_id, "result": i.result,
             "scan_time": str(i.scan_time) if i.scan_time else None,
             "ai_model_version": i.ai_model_version}
            for i in inspections
        ],
    })


@router.get("/security")
def security_report(db: Session = Depends(get_db)):
    total = db.query(func.count(m_identity.FaceVerificationLog.verification_id)).scalar() or 0
    verified = db.query(func.count(m_identity.FaceVerificationLog.verification_id)).filter(
        m_identity.FaceVerificationLog.verification_status == "verified").scalar() or 0
    failed = db.query(func.count(m_identity.FaceVerificationLog.verification_id)).filter(
        m_identity.FaceVerificationLog.verification_status == "failed").scalar() or 0
    gate_auth = db.query(func.count(m_security.SecurityGateLog.gate_log_id)).filter(
        m_security.SecurityGateLog.authorization_result == "authorized").scalar() or 0
    gate_denied = db.query(func.count(m_security.SecurityGateLog.gate_log_id)).filter(
        m_security.SecurityGateLog.authorization_result == "denied").scalar() or 0
    return success_response(data={
        "verifications_total": total,
        "verified": verified,
        "failed": failed,
        "verification_rate": (verified / total) if total else 0,
        "gate_authorized": gate_auth,
        "gate_denied": gate_denied,
    })


@router.get("/ai")
def ai_report(db: Session = Depends(get_db)):
    logs = db.query(m_identity.FaceVerificationLog).order_by(
        m_identity.FaceVerificationLog.verification_id.desc()).limit(100).all()
    sims = [float(x.cosine_similarity) for x in logs if x.cosine_similarity is not None]
    return success_response(data={
        "face_attempts": db.query(func.count(m_identity.FaceVerificationLog.verification_id)).scalar() or 0,
        "avg_similarity": (sum(sims) / len(sims)) if sims else 0,
        "inspections": db.query(func.count(m_bagsec.BaggageInspection.inspection_id)).scalar() or 0,
        "detected_items": db.query(func.count(m_bagsec.DetectedItem.item_id)).scalar() or 0,
        "monitoring_alerts": db.query(func.count(m_admin.MonitoringAlert.alert_id)).scalar() or 0,
        "recent_verifications": [
            {"verification_id": x.verification_id, "passenger_id": x.passenger_id,
             "verification_status": x.verification_status,
             "cosine_similarity": float(x.cosine_similarity) if x.cosine_similarity is not None else None,
             "timestamp": str(x.timestamp) if x.timestamp else None}
            for x in logs
        ],
    })


@router.get("/iot")
def iot_report(db: Session = Depends(get_db)):
    devices = db.query(m_devices.Equipment).all()
    by_status: dict[str, int] = {}
    for d in devices:
        s = getattr(d, "status", "unknown") or "unknown"
        by_status[s] = by_status.get(s, 0) + 1
    health = db.query(m_devices.EquipmentHealthCheck).order_by(
        m_devices.EquipmentHealthCheck.check_id.desc()).limit(100).all()
    return success_response(data={
        "devices_total": len(devices),
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "recent_health": [
            {"check_id": h.check_id, "equipment_id": h.equipment_id,
             "metric_type": h.metric_type, "value": float(h.value) if h.value is not None else None,
             "status_result": h.status_result, "check_time": str(h.check_time) if h.check_time else None}
            for h in health
        ],
    })


@router.get("/operations")
def operations_report(db: Session = Depends(get_db)):
    emergencies = db.query(m_admin.EmergencyEvent).order_by(
        m_admin.EmergencyEvent.event_id.desc()).limit(100).all()
    alerts = db.query(m_admin.MonitoringAlert).order_by(
        m_admin.MonitoringAlert.alert_id.desc()).limit(100).all()
    return success_response(data={
        "emergencies_total": db.query(func.count(m_admin.EmergencyEvent.event_id)).scalar() or 0,
        "alerts_total": db.query(func.count(m_admin.MonitoringAlert.alert_id)).scalar() or 0,
        "emergencies": [
            {"event_id": e.event_id, "event_type": e.event_type, "status": e.status,
             "detected_time": str(e.detected_time) if e.detected_time else None}
            for e in emergencies
        ],
        "alerts": [
            {"alert_id": a.alert_id, "behavior_type": a.behavior_type,
             "severity": a.severity, "status": a.status,
             "timestamp": str(a.timestamp) if a.timestamp else None}
            for a in alerts
        ],
    })
