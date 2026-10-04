"""Shared pytest fixtures — isolated DB/FAISS and mocked DeepFace embeddings."""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.services.faiss_index import FaissIndex

ROOT = Path(__file__).resolve().parents[1]
IMAGES_ROOT = ROOT / "data" / "Original Images"


def person_embedding(person: str, dim: int = 512, noise: float = 0.0) -> np.ndarray:
    """Deterministic unit embedding from a person name (mock ArcFace output)."""
    seed = int(hashlib.sha256(person.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    vec = rng.standard_normal(dim).astype(np.float32)
    if noise > 0:
        vec = vec + rng.standard_normal(dim).astype(np.float32) * noise
    return vec / np.linalg.norm(vec)


def sample_image(person: str, index: int = 0) -> Path:
    folder = IMAGES_ROOT / person
    files = sorted(folder.glob("*.jpg"))
    if not files:
        raise FileNotFoundError(f"No images for {person} under {folder}")
    return files[index % len(files)]


@pytest.fixture
def tmp_faiss(tmp_path) -> FaissIndex:
    return FaissIndex(
        dim=settings.embedding_dim,
        index_path=str(tmp_path / "faiss.index"),
        ids_path=str(tmp_path / "faiss_ids.npy"),
    )


@pytest.fixture
def db_session(tmp_path):
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from app import models  # noqa: F401
    from app.services import baggage as _baggage  # noqa: F401
    from app.services import emergency as _emergency  # noqa: F401
    from app.services import kiosk_models as _kiosk_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def mock_person():
    """Mutable holder for which celebrity embedding DeepFace should return."""
    state = {"name": "Brad Pitt"}

    def set_name(name: str):
        state["name"] = name

    state["set"] = set_name  # type: ignore[index]
    return state


@pytest.fixture
def client(tmp_path, monkeypatch, tmp_faiss, mock_person):
    """FastAPI TestClient with isolated SQLite + FAISS and mocked embeddings."""
    db_file = tmp_path / "api.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from app import models  # noqa: F401
    from app.services import baggage as _baggage  # noqa: F401
    from app.services import emergency as _emergency  # noqa: F401
    from app.services import kiosk_models as _kiosk_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    import app.main as main_mod
    import app.services.faiss_index as faiss_mod
    import app.services.matcher as matcher_mod
    import app.services.verification as verification_mod

    monkeypatch.setattr(faiss_mod, "faiss_index", tmp_faiss)
    monkeypatch.setattr(verification_mod, "faiss_index", tmp_faiss)
    monkeypatch.setattr(matcher_mod, "faiss_index", tmp_faiss)
    monkeypatch.setattr(main_mod, "faiss_index", tmp_faiss)
    monkeypatch.setattr(main_mod, "on_startup", lambda: None)

    def extract_embedding(image: np.ndarray) -> np.ndarray:
        return person_embedding(mock_person["name"], noise=0.02)

    monkeypatch.setattr(verification_mod, "extract_embedding", extract_embedding)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    from app.main import app

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
