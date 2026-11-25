import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.admin_cameras import EmergencyEvent, MonitoringAlert
from ..models.agents import AirportEvent
from ..utils.response_envelope import success_response
from ..utils.auth import get_current_user

router = APIRouter()

class K9AlertRequest(BaseModel):
    patrolId: int
    k9Id: int
    bagId: int
    passengerId: Optional[int] = None
    location: str
    alertType: str

@router.post("/alerts", dependencies=[Depends(get_current_user)])
def log_k9_alert(payload: K9AlertRequest, db: Session = Depends(get_db)):
    """Persist K9 unit security alert into EmergencyEvent and MonitoringAlert tables."""
    now = datetime.utcnow()

    alert_row = MonitoringAlert(
        camera_id=None,
        zone_id=1,
        behavior_type=f"k9_alert_{payload.alertType}".lower()[:30],
        severity="High",
        status="open",
        timestamp=now
    )
    db.add(alert_row)
    db.commit()
    db.refresh(alert_row)

    emergency_row = EmergencyEvent(
        event_type=f"K9_{payload.alertType.upper()}",
        zone_id=1,
        status="detected",
        detected_time=now
    )
    db.add(emergency_row)
    db.commit()
    db.refresh(emergency_row)

    return success_response(data={
        "alertId": alert_row.alert_id,
        "emergencyEventId": emergency_row.event_id,
        "patrolId": payload.patrolId,
        "k9Id": payload.k9Id,
        "bagId": payload.bagId,
        "passengerId": payload.passengerId,
        "location": payload.location,
        "alertType": payload.alertType,
        "status": "UNCONFIRMED_FLAGGED",
        "createdAt": now.isoformat() + "Z"
    }, status_code=201)
