import os
from pydantic_settings import BaseSettings

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
    MQTT_BROKER: str = os.getenv("MQTT_BROKER", "localhost")
    MQTT_PORT: int = int(os.getenv("MQTT_PORT", "1883"))
    MQTT_USERNAME: str = os.getenv("MQTT_USERNAME", "")
    MQTT_PASSWORD: str = os.getenv("MQTT_PASSWORD", "")
    # MQTT topic filter, e.g. "airport/#" (convention: airport/{module}/{device_id}/{event}).
    MQTT_TOPIC_FILTER: str = os.getenv("MQTT_TOPIC_FILTER", "airport/#")
    # Digital Twin API base URL. In Docker this resolves to the `twin` compose
    # service; locally it defaults to localhost:8100.
    TWIN_BASE_URL: str = os.getenv("TWIN_BASE_URL", "http://localhost:8100")
    # Digital Twin API bearer token (operator role) for authenticated ingest.
    # Obtain via POST /api/twin/auth/token (operator:op123 by default).
    TWIN_AUTH_TOKEN: str = os.getenv("TWIN_AUTH_TOKEN", "")

    # Cloudinary Cloud Storage configuration for documents and face photos
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")

    class Config:
        env_file = ".env"
        # STRICT: unknown .env variables raise ValidationError instead of
        # being silently ignored. Every key in .env/.env.example must map
        # to a field above. Do NOT relax this to "ignore".
        extra = "forbid"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS: "*" -> ["*"], else comma-separated origins."""
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

settings = Settings()
