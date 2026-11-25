from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.devices import Equipment, EquipmentHealthCheck
from ..schemas.devices import EquipmentHealthCheckCreate
from ..utils.response_envelope import success_response
from ..utils.auth import verify_api_key

router = APIRouter()


@router.post("/telemetry", dependencies=[Depends(verify_api_key)])
def report_telemetry(payload: EquipmentHealthCheckCreate, db: Session = Depends(get_db)):
    """Persist IoT sensor equipment telemetry to database and update equipment status."""
    now = datetime.utcnow()

    # 1. Update equipment status in database
    equip = None
    if payload.equipment_id:
        equip = db.query(Equipment).filter(Equipment.equipment_id == payload.equipment_id).first()
        if equip:
            status_str = (payload.status_result or "normal").lower()
            equip.status = "operational" if status_str in ["ok", "normal", "pass", "healthy"] else "warning"
            equip.last_health_check = now
            equip.updated_at = now

    # 2. Record real health check log into database
    check_row = EquipmentHealthCheck(
        equipment_id=payload.equipment_id,
        check_time=payload.check_time or now,
        metric_type=payload.metric_type,
        value=payload.value,
        status_result=payload.status_result,
        created_at=now,
        updated_at=now,
    )
    db.add(check_row)
    db.commit()
    db.refresh(check_row)

    return success_response(data={
        "checkId": check_row.check_id,
        "equipmentId": check_row.equipment_id,
        "metricType": check_row.metric_type,
        "value": float(check_row.value) if check_row.value is not None else None,
        "statusResult": check_row.status_result,
        "checkTime": check_row.check_time.isoformat() + "Z" if check_row.check_time else None,
    })
