"""STALE / LEGACY config — do NOT use for new code.

The single configuration source is ``app/config.py`` (``settings``).
This module is retained only so the legacy ``app/db/session.py`` import chain
stays importable. It must never contain real credentials.
"""
import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Airport System"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://smart_airport:change-me@localhost:5432/smart_airport",
    )

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
