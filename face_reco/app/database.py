from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from pathlib import Path

    Path(settings.database_url.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
    from app import models  # noqa: F401
    from app.services import baggage as _baggage  # noqa: F401
    from app.services import emergency as _emergency  # noqa: F401
    from app.services import kiosk_models as _kiosk_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
