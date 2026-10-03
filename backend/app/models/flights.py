from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class Airline(Base):
    __tablename__ = 'airline'

    airline_id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    iata_code = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Airport(Base):
    __tablename__ = 'airport'

    airport_id = Column(Integer, primary_key=True, index=True)
    iata_code = Column(String, unique=True, index=True)
    city = Column(String)
    country_code = Column(String, ForeignKey('country.country_code'), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Flight(Base):
    __tablename__ = 'flight'

    flight_id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String)
    airline_id = Column(Integer, ForeignKey('airline.airline_id'), index=True)
    origin_airport_id = Column(Integer, ForeignKey('airport.airport_id'), index=True)
    destination_airport_id = Column(Integer, ForeignKey('airport.airport_id'), index=True)
    scheduled_departure = Column(DateTime)
    actual_departure = Column(DateTime)
    boarding_gate_id = Column(Integer, ForeignKey('boardinggate.boarding_gate_id'), index=True)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Booking(Base):
    __tablename__ = 'booking'

    booking_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    flight_id = Column(Integer, ForeignKey('flight.flight_id'), index=True)
    booking_reference = Column(String, unique=True, index=True)
    seat_number = Column(String)
    booking_class = Column(String)
    booking_status = Column(String)
    created_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    __tablename__ = 'notification'

    notification_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    staff_id = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    channel = Column(String)
    notification_type = Column(String)
    content = Column(String)
    related_entity_type = Column(String)
    related_entity_id = Column(Integer)
    sent_at = Column(DateTime)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

