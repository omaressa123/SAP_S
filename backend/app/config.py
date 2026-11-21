import os
from pathlib import Path
from pydantic_settings import BaseSettings

_env_file = str(Path(__file__).resolve().parent.parent / ".env")

class Settings(BaseSettings):
    # PostgreSQL is the production source of truth.
    # SQLite remains only as a local/dev fallback when DATABASE_URL is unset.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:yahya2004718@localhost:5432/smart_airport",
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    API_KEY: str = os.getenv("API_KEY", "MOCK_API_KEY_123")
    # CORS origins: "*" or comma-separated list, e.g.
    # "http://localhost:5173,http://localhost:8081".
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    FACE_RECO_URL: str = os.getenv("FACE_RECO_URL", "http://localhost:8001")
    BTD_URL: str = os.getenv("BTD_URL", "http://localhost:8002")
    # BTD HTTP inference endpoint (AI/BTD/inference_server.py) — real YOLO11
    # X-ray baggage threat detection. Optional; core backend works without it.
    BTD_INFERENCE_URL: str = os.getenv("BTD_INFERENCE_URL", "http://localhost:8002")
    SMOKE_FIRE_URL: str = os.getenv("SMOKE_FIRE_URL", "http://localhost:8003")
    FULL_DETECTION_URL: str = os.getenv("FULL_DETECTION_URL", "http://localhost:8004")

    # Cloudinary Cloud Storage configuration for documents and face photos
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    # Host & Database parameters
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "smart_airport")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", 5432))
    MQTT_HOST_PORT: int = int(os.getenv("MQTT_HOST_PORT", 1883))
    FRONTEND_HOST_PORT: int = int(os.getenv("FRONTEND_HOST_PORT", 80))
    VITE_API_URL: str = os.getenv("VITE_API_URL", "http://localhost:8000")

    class Config:
        env_file = _env_file
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS: "*" -> ["*"], else comma-separated origins."""
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

settings = Settings()
