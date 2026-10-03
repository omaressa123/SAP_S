from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from ..database import Base

class Passenger(Base):
    __tablename__ = "passengers"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    passport_number = Column(String, unique=True, index=True)
    biometric_registered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
