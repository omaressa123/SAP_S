from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import emergency as emergency_svc

router = APIRouter(tags=["emergency"])


class SmokeAlertRequest(BaseModel):
    zone: str
    message: str | None = None


class AlertOut(BaseModel):
    alert_id: int
    alert_type: str
    zone: str
    message: str
    active: bool

    model_config = {"from_attributes": True}


@router.post("/emergency/smoke", response_model=AlertOut)
def smoke_detected(payload: SmokeAlertRequest, db: Session = Depends(get_db)):
    alert = emergency_svc.raise_smoke_alert(db, zone=payload.zone, message=payload.message)
    return AlertOut.model_validate(alert)


@router.get("/emergency/alerts", response_model=list[AlertOut])
def dashboard_alerts(db: Session = Depends(get_db)):
    return [AlertOut.model_validate(a) for a in emergency_svc.list_active_alerts(db)]
