from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import VerifyResponse
from app.services import verification as svc

router = APIRouter(tags=["verification"])


@router.post("/verify", response_model=VerifyResponse)
async def verify_entry(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM-ENTRY-01"),
    db: Session = Depends(get_db),
):
    """Checkpoint 1 — Entry gate face recognition."""
    img = await svc.read_image_bytes(image)
    embedding = svc.extract_embedding(img)
    return svc.verify_entry(db, embedding, camera_id)
