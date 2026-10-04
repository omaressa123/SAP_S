from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import FaceVerificationLog
from app.schemas import LogOut

router = APIRouter(tags=["logs"])


@router.get("/logs", response_model=list[LogOut])
def get_logs(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FaceVerificationLog)
        .options(joinedload(FaceVerificationLog.passenger))
        .order_by(FaceVerificationLog.verification_id.desc())
        .limit(limit)
        .all()
    )
    return [
        LogOut(
            verification_id=row.verification_id,
            passenger_id=row.passenger_id,
            passenger_name=row.passenger.name if row.passenger else None,
            checkpoint=row.checkpoint,
            similarity=row.similarity,
            camera_id=row.camera_id,
            result=row.result,
            created_at=row.created_at,
        )
        for row in rows
    ]
