from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class UserAccount(Base):
    __tablename__ = 'useraccount'

    user_account_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    linked_person_type = Column(String)
    linked_person_id = Column(Integer)
    is_active = Column(Boolean)
    last_login = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Camera(Base):
    __tablename__ = 'camera'

    camera_id = Column(Integer, primary_key=True, index=True)
    location = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    camera_type = Column(String)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MonitoringAlert(Base):
    __tablename__ = 'monitoringalert'

    alert_id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey('camera.camera_id'), index=True)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    behavior_type = Column(String)
    severity = Column(String)
    status = Column(String)
    linked_emergency_event_id = Column(Integer, ForeignKey('emergencyevent.event_id'), index=True)
    resolved_by_staff_id = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmergencyEvent(Base):
    __tablename__ = 'emergencyevent'

    event_id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    notified_staff_id = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    status = Column(String)
    detected_time = Column(DateTime)
    resolved_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = 'auditlog'

    audit_id = Column(Integer, primary_key=True, index=True)
    user_account_id = Column(Integer, ForeignKey('useraccount.user_account_id'), index=True)
    action = Column(String)
    entity_type = Column(String)
    entity_id = Column(Integer)
    ip_address = Column(String)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

