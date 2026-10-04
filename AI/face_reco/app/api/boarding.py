from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import VerifyResponse
from app.services import verification as svc

router = APIRouter(tags=["boarding"])


@router.post("/boarding", response_model=VerifyResponse)
async def boarding_gate(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM-BOARD-01"),
    expected_flight_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Checkpoint 3 — Boarding gate: face match + flight match → board/deny."""
    img = await svc.read_image_bytes(image)
    embedding = svc.extract_embedding(img)
    return svc.verify_boarding(db, embedding, camera_id, expected_flight_id)
