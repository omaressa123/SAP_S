from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class SecurityGate(Base):
    __tablename__ = 'securitygate'

    gate_id = Column(Integer, primary_key=True, index=True)
    location = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SecurityGateLog(Base):
    __tablename__ = 'securitygatelog'

    gate_log_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    gate_id = Column(Integer, ForeignKey('securitygate.gate_id'), index=True)
    verification_id = Column(Integer, ForeignKey('faceverificationlog.verification_id'), index=True)
    authorization_result = Column(String)
    gate_opened = Column(Boolean)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BoardingGate(Base):
    __tablename__ = 'boardinggate'

    boarding_gate_id = Column(Integer, primary_key=True, index=True)
    gate_number = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BoardingLog(Base):
    __tablename__ = 'boardinglog'

    boarding_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    flight_id = Column(Integer, ForeignKey('flight.flight_id'), index=True)
    boarding_gate_id = Column(Integer, ForeignKey('boardinggate.boarding_gate_id'), index=True)
    verification_id = Column(Integer, ForeignKey('faceverificationlog.verification_id'), index=True)
    boarding_status = Column(String)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

