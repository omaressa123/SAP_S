"""Reporting / analytics API layer.

Controller -> Service (inline aggregation) -> SQLAlchemy -> PostgreSQL.
All numbers come from the database. Empty DB => zeros + empty lists
(frontend renders honest empty states, never fake data).
"""
from collections import defaultdict
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
from ..models import agents as m_agents

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


def _bucket_by_day(timestamps):
    counts: dict[str, int] = defaultdict(int)
    for ts in timestamps:
        if ts is None:
            continue
        day = ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
        counts[day] += 1
    return [{"label": k, "count": counts[k]} for k in sorted(counts.keys())]


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
    pax_rows = q.all()
    total = len(pax_rows)

    fv_q = db.query(m_identity.FaceVerificationLog).filter(
        m_identity.FaceVerificationLog.verification_status == "verified"
    )
    ci_q = db.query(m_checkin.CheckInRecord)
    bd_q = db.query(m_security.BoardingLog).filter(
        m_security.BoardingLog.boarding_status == "boarded"
    )
    if df:
        fv_q = fv_q.filter(m_identity.FaceVerificationLog.timestamp >= df)
        ci_q = ci_q.filter(m_checkin.CheckInRecord.checkin_time >= df)
        bd_q = bd_q.filter(m_security.BoardingLog.boarding_time >= df)
    if dt:
        fv_q = fv_q.filter(m_identity.FaceVerificationLog.timestamp <= dt)
        ci_q = ci_q.filter(m_checkin.CheckInRecord.checkin_time <= dt)
        bd_q = bd_q.filter(m_security.BoardingLog.boarding_time <= dt)

    verified_rows = fv_q.all()
    checkin_rows = ci_q.all()
    boarded_rows = bd_q.all()

    verified = len(verified_rows)
    checked_in = len(checkin_rows)
    boarded = len(boarded_rows)
    registered_only = max(0, total - max(checked_in, boarded, verified))

    activity_series = _bucket_by_day(
        [r.created_at for r in pax_rows]
        + [r.checkin_time for r in checkin_rows]
        + [r.boarding_time for r in boarded_rows]
        + [r.timestamp for r in verified_rows]
    )

    return success_response(data={
        "total": total,
        "verified": verified,
        "checked_in": checked_in,
        "boarded": boarded,
        "status_distribution": [
            {"status": "Checked-in", "count": checked_in},
            {"status": "Boarded", "count": boarded},
            {"status": "Verified", "count": verified},
            {"status": "Registered / Pending", "count": registered_only},
        ],
        "activity_series": activity_series,
    })


@router.get("/flights")
def flights_report(
    db: Session = Depends(get_db),
    status: str | None = Query(default=None),
    airline_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    q = db.query(m_flights.Flight)
    df, dt = _parse_dt(date_from), _parse_dt(date_to)
    if status:
        q = q.filter(m_flights.Flight.status == status)
    if airline_id:
        q = q.filter(m_flights.Flight.airline_id == airline_id)
    if df:
        q = q.filter(m_flights.Flight.scheduled_departure >= df)
    if dt:
        q = q.filter(m_flights.Flight.scheduled_departure <= dt)
    rows = q.all()
    dist: dict[str, int] = {}
    for f in rows:
        st = (getattr(f, "status", "unknown") or "unknown").lower()
        dist[st] = dist.get(st, 0) + 1
    activity_series = _bucket_by_day([f.scheduled_departure or f.created_at for f in rows])
    return success_response(data={
        "total": len(rows),
        "by_status": [{"status": k, "count": v} for k, v in dist.items()],
        "activity_series": activity_series,
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
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    q = db.query(m_checkin.Bag)
    df, dt = _parse_dt(date_from), _parse_dt(date_to)
    if status:
        q = q.filter(m_checkin.Bag.current_status == status)
    if df:
        q = q.filter(m_checkin.Bag.created_at >= df)
    if dt:
        q = q.filter(m_checkin.Bag.created_at <= dt)
    bags = q.all()
    by_status: dict[str, int] = {}
    for b in bags:
        s = (getattr(b, "current_status", "unknown") or "unknown").lower()
        by_status[s] = by_status.get(s, 0) + 1

    insp_q = db.query(m_bagsec.BaggageInspection)
    if df:
        insp_q = insp_q.filter(m_bagsec.BaggageInspection.scan_time >= df)
    if dt:
        insp_q = insp_q.filter(m_bagsec.BaggageInspection.scan_time <= dt)
    inspections = insp_q.order_by(m_bagsec.BaggageInspection.inspection_id.desc()).limit(200).all()

    by_result: dict[str, int] = {}
    for i in inspections:
        r = getattr(i, "result", "unknown") or "unknown"
        by_result[r] = by_result.get(r, 0) + 1
    detections = db.query(m_bagsec.DetectedItem).limit(500).all()
    activity_series = _bucket_by_day([b.created_at for b in bags] + [i.scan_time for i in inspections])

    return success_response(data={
        "total_bags": len(bags),
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "inspections_total": db.query(func.count(m_bagsec.BaggageInspection.inspection_id)).scalar() or 0,
        "by_result": [{"result": k, "count": v} for k, v in by_result.items()],
        "activity_series": activity_series,
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
def operations_report(
    db: Session = Depends(get_db),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    df, dt = _parse_dt(date_from), _parse_dt(date_to)
    emergencies = db.query(m_admin.EmergencyEvent).order_by(
        m_admin.EmergencyEvent.event_id.desc()).limit(100).all()
    alerts = db.query(m_admin.MonitoringAlert).order_by(
        m_admin.MonitoringAlert.alert_id.desc()).limit(100).all()

    checkins = db.query(m_checkin.CheckInRecord).all()
    boardings = db.query(m_security.BoardingLog).all()
    inspections = db.query(m_bagsec.BaggageInspection).all()
    workflows = db.query(m_agents.WorkflowExecution).all()

    if df:
        checkins = [c for c in checkins if c.checkin_time and c.checkin_time >= df]
        boardings = [b for b in boardings if b.boarding_time and b.boarding_time >= df]
        inspections = [i for i in inspections if i.scan_time and i.scan_time >= df]
        workflows = [w for w in workflows if w.started_at and w.started_at >= df]
    if dt:
        checkins = [c for c in checkins if c.checkin_time and c.checkin_time <= dt]
        boardings = [b for b in boardings if b.boarding_time and b.boarding_time <= dt]
        inspections = [i for i in inspections if i.scan_time and i.scan_time <= dt]
        workflows = [w for w in workflows if w.started_at and w.started_at <= dt]

    completed = (
        len(checkins)
        + sum(1 for b in boardings if (b.boarding_status or "").lower() == "boarded")
        + sum(1 for i in inspections if (i.result or "").upper() == "SAFE")
        + sum(1 for w in workflows if (w.status or "").lower() == "completed")
    )
    in_progress = sum(1 for w in workflows if (w.status or "").lower() == "running")
    pending = sum(1 for w in workflows if (w.status or "").lower() == "pending")
    exceptions = (
        sum(1 for i in inspections if (i.result or "").upper() != "SAFE")
        + sum(1 for w in workflows if (w.status or "").lower() == "failed")
    )
    total_activities = completed + in_progress + pending + exceptions

    activity_series = _bucket_by_day(
        [c.checkin_time for c in checkins]
        + [b.boarding_time for b in boardings]
        + [i.scan_time for i in inspections]
        + [w.started_at for w in workflows]
    )

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
        "operations_summary": {
            "total_activities": total_activities,
            "completed": completed,
            "in_progress": in_progress,
            "pending": pending,
            "exceptions": exceptions,
            "by_status": [
                {"status": "Completed", "count": completed},
                {"status": "In Progress", "count": in_progress},
                {"status": "Pending", "count": pending},
                {"status": "Exceptions", "count": exceptions},
            ],
            "by_category": [
                {"category": "Passenger Check-ins", "count": len(checkins)},
                {"category": "Gate Boardings", "count": len(boardings)},
                {"category": "Baggage Inspections", "count": len(inspections)},
                {"category": "Operational Workflows", "count": len(workflows)},
            ],
            "activity_series": activity_series,
        },
    })
