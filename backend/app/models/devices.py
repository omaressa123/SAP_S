from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class Equipment(Base):
    __tablename__ = 'equipment'

    equipment_id = Column(Integer, primary_key=True, index=True)
    equipment_type = Column(String)
    label = Column(String)
    serial_number = Column(String, unique=True, index=True)
    model = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    install_date = Column(Date)
    firmware_version = Column(String)
    status = Column(String)
    last_health_check = Column(DateTime)
    updated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class EquipmentHealthCheck(Base):
    __tablename__ = 'equipmenthealthcheck'

    check_id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    check_time = Column(DateTime)
    metric_type = Column(String)
    value = Column(DECIMAL(8,2))
    status_result = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

