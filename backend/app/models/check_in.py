from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class CheckInRecord(Base):
    __tablename__ = 'checkinrecord'

    checkin_id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey('booking.booking_id'), index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    checkin_time = Column(DateTime)
    updated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class Bag(Base):
    __tablename__ = 'bag'

    bag_id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey('booking.booking_id'), index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    checkin_id = Column(Integer, ForeignKey('checkinrecord.checkin_id'), index=True)
    rfid_tag = Column(String, unique=True, index=True)
    qr_code = Column(String, unique=True, index=True)
    weight_kg = Column(DECIMAL(5,2))
    length_cm___width_cm___height_cm = Column(DECIMAL(5,2))
    excess_charge = Column(DECIMAL(8,2))
    current_status = Column(String)
    current_location = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class BagCheckpointLog(Base):
    __tablename__ = 'bagcheckpointlog'

    checkpoint_log_id = Column(Integer, primary_key=True, index=True)
    bag_id = Column(Integer, ForeignKey('bag.bag_id'), index=True)
    checkpoint_type = Column(String)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    location = Column(String)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

