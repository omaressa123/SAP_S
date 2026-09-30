from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration for the airport face-recognition pipeline."""

    app_name: str = "Airport Face Recognition"
    model_name: str = "ArcFace"
    detector_backend: str = "retinaface"
    model_version: str = "ArcFace-v1"

    # ArcFace cosine similarity threshold.
    # DeepFace ArcFace default cosine *distance* is 0.68 → similarity ≈ 0.32.
    # Production systems typically raise this slightly for fewer false accepts.
    # Explicitly avoid naive 0.5 / 0.7 cutoffs.
    similarity_threshold: float = 0.40
    faiss_top_k: int = 5

    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / 'airport.db'}"
    faiss_index_path: str = str(Path(__file__).resolve().parent.parent / "data" / "faiss.index")
    faiss_ids_path: str = str(Path(__file__).resolve().parent.parent / "data" / "faiss_ids.npy")
    embedding_dim: int = 512

    class Config:
        env_prefix = "FACE_"


settings = Settings()
