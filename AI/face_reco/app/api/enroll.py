from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.schemas import EnrollResponse
from app.services import verification as svc

router = APIRouter(tags=["enrollment"])


@router.post("/enroll", response_model=EnrollResponse)
async def enroll(
    name: str = Form(...),
    passport: str = Form(...),
    flight_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Stage 3 — Enrollment (once per passenger):
    Photo → Detect → Align → Embedding → Save PassengerID + 512-D vector.
    """
    img = await svc.read_image_bytes(image)
    passenger = svc.enroll_passenger(
        db, name=name, passport=passport, flight_id=flight_id, image=img
    )
    return EnrollResponse(
        passenger_id=passenger.passenger_id,
        name=passenger.name,
        passport=passenger.passport,
        flight_id=passenger.flight_id,
        embedding_id=passenger.embedding_id,
        model_version=settings.model_version,
        created_at=passenger.created_at,
    )
