"""Smart check-in kiosk API."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import kiosk as kiosk_svc
from app.services.kiosk_models import KioskBoardingPass

router = APIRouter(prefix="/kiosk", tags=["kiosk"])


class StartSessionRequest(BaseModel):
    kiosk_id: str = "KIOSK-01"
    flight_id: str = "GV101"


class SessionOut(BaseModel):
    session_id: int
    kiosk_id: str
    flight_id: str
    status: str
    message: str | None = None


@router.post("/session", response_model=SessionOut)
def start_session(payload: StartSessionRequest, db: Session = Depends(get_db)):
    """Step 0 — open a kiosk session (camera will prompt for face)."""
    session = kiosk_svc.create_session(db, kiosk_id=payload.kiosk_id, flight_id=payload.flight_id)
    return SessionOut(
        session_id=session.session_id,
        kiosk_id=session.kiosk_id,
        flight_id=session.flight_id,
        status=session.status.value,
        message="Please look at the camera",
    )


@router.post("/session/{session_id}/face")
async def capture_face(
    session_id: int,
    frame1: UploadFile = File(...),
    frame2: UploadFile | None = File(None),
    frame3: UploadFile | None = File(None),
    skip_liveness: bool = Form(False),
    db: Session = Depends(get_db),
):
    """
    Step 1 — webcam face + liveness.

    Send 2–3 frames from the live camera for motion-based liveness.
    """
    frames = [kiosk_svc.decode_data_url_or_bytes(await frame1.read())]
    for extra in (frame2, frame3):
        if extra is not None:
            frames.append(kiosk_svc.decode_data_url_or_bytes(await extra.read()))
    return kiosk_svc.capture_live_face(
        db, session_id=session_id, frames=frames, skip_liveness=skip_liveness
    )


@router.post("/session/{session_id}/passport")
async def scan_passport(
    session_id: int,
    image: UploadFile = File(...),
    mrz_text: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """
    Steps 2–4 — passport data page: OCR/MRZ + holder photo extraction.

    Optional `mrz_text` bypasses OCR (useful in demos / CI).
    """
    img = kiosk_svc.decode_data_url_or_bytes(await image.read())
    return kiosk_svc.scan_passport(db, session_id=session_id, passport_image=img, mrz_text=mrz_text)


@router.post("/session/{session_id}/verify")
def verify_and_issue(session_id: int, db: Session = Depends(get_db)):
    """
    Steps 5–6 — camera face vs passport face, then issue boarding pass (Code128).
    """
    return kiosk_svc.verify_identity(db, session_id=session_id)


@router.get("/boarding-pass/{pass_id}", response_class=HTMLResponse)
def print_boarding_pass(pass_id: str, db: Session = Depends(get_db)):
    """Thermal-printer friendly HTML boarding pass."""
    row = db.query(KioskBoardingPass).filter(KioskBoardingPass.pass_id == pass_id).first()
    if row is None or not row.html_path:
        return HTMLResponse("<h1>Boarding pass not found</h1>", status_code=404)
    path = Path(row.html_path)
    if not path.exists():
        return HTMLResponse("<h1>Boarding pass file missing</h1>", status_code=404)
    row.printed = True
    db.commit()
    return HTMLResponse(path.read_text(encoding="utf-8"))


@router.get("/boarding-pass/{pass_id}/file")
def boarding_pass_file(pass_id: str, db: Session = Depends(get_db)):
    row = db.query(KioskBoardingPass).filter(KioskBoardingPass.pass_id == pass_id).first()
    if row is None or not row.html_path:
        return HTMLResponse("<h1>Not found</h1>", status_code=404)
    return FileResponse(row.html_path, media_type="text/html", filename=f"{pass_id}.html")
