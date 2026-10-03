from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class PowerSource(Base):
    __tablename__ = 'powersource'

    source_id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SolarInstallation(Base):
    __tablename__ = 'solarinstallation'

    installation_id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    capacity_kw = Column(DECIMAL(8,2))
    panel_count = Column(Integer)
    installed_date = Column(Date)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EnergyGenerationLog(Base):
    __tablename__ = 'energygenerationlog'

    log_id = Column(Integer, primary_key=True, index=True)
    installation_id = Column(Integer, ForeignKey('solarinstallation.installation_id'), index=True)
    timestamp = Column(DateTime)
    kwh_generated = Column(DECIMAL(8,3))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EnergyStorage(Base):
    __tablename__ = 'energystorage'

    battery_id = Column(Integer, primary_key=True, index=True)
    installation_id = Column(Integer, ForeignKey('solarinstallation.installation_id'), index=True)
    capacity_kwh = Column(DECIMAL(8,2))
    current_charge_pct = Column(DECIMAL(5,2))
    status = Column(String)
    last_updated = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EnergyConsumptionLog(Base):
    __tablename__ = 'energyconsumptionlog'

    log_id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    source_id = Column(Integer, ForeignKey('powersource.source_id'), index=True)
    timestamp = Column(DateTime)
    kwh_consumed = Column(DECIMAL(8,3))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

