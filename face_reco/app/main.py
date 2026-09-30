from app import env_config

# Initialize environment and suppress CUDA warnings before other imports
env_config.setup_tf()

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    baggage,
    boarding,
    emergency,
    enroll,
    kiosk,
    logs,
    passengers,
    security,
    verify,
)
from app.config import settings
from app.database import init_db
from app.models import FaceEmbedding, Passenger

# Import side-effect models (baggage / emergency / kiosk tables)
from app.services import baggage as _baggage  # noqa: F401
from app.services import emergency as _emergency  # noqa: F401
from app.services import kiosk_models as _kiosk_models  # noqa: F401
from app.services.face_embedder import face_embedder
from app.services.faiss_index import faiss_index

app = FastAPI(title=settings.app_name, version="1.0.0")

app.include_router(enroll.router)
app.include_router(verify.router)
app.include_router(security.router)
app.include_router(boarding.router)
app.include_router(passengers.router)
app.include_router(logs.router)
app.include_router(baggage.router)
app.include_router(emergency.router)
app.include_router(kiosk.router)

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    # Rebuild FAISS from DB if index is empty but embeddings exist
    if faiss_index.index.ntotal == 0:
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            rows = db.query(FaceEmbedding).all()
            items = []
            for row in rows:
                passenger = db.get(Passenger, row.passenger_id)
                if passenger and passenger.embedding_id == row.embedding_id:
                    items.append((row.passenger_id, face_embedder.from_json(row.embedding)))
            if items:
                faiss_index.rebuild(items)
        finally:
            db.close()


@app.get("/")
def dashboard():
    return FileResponse(STATIC_DIR / "dashboard.html")


@app.get("/kiosk")
def kiosk_ui():
    return FileResponse(STATIC_DIR / "kiosk.html")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": settings.model_name,
        "detector": settings.detector_backend,
        "threshold": settings.similarity_threshold,
        "faiss_vectors": faiss_index.index.ntotal,
    }
