from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import VerifyResponse
from app.services import verification as svc

router = APIRouter(tags=["security"])


@router.post("/security", response_model=VerifyResponse)
async def security_gate(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM-SEC-01"),
    db: Session = Depends(get_db),
):
    """Checkpoint 2 — Security gate: face match + security status → open/deny."""
    img = await svc.read_image_bytes(image)
    embedding = svc.extract_embedding(img)
    return svc.verify_security(db, embedding, camera_id)
