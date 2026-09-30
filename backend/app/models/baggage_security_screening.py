from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class BaggageInspection(Base):
    __tablename__ = 'baggageinspection'

    inspection_id = Column(Integer, primary_key=True, index=True)
    bag_id = Column(Integer, ForeignKey('bag.bag_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    scan_time = Column(DateTime)
    ai_model_version = Column(String)
    result = Column(String)
    reviewed_by_staff_id = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DetectedItem(Base):
    __tablename__ = 'detecteditem'

    item_id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey('baggageinspection.inspection_id'), index=True)
    item_type = Column(String)
    confidence_score = Column(DECIMAL(5,2))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

