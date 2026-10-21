from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class Country(Base):
    __tablename__ = 'country'

    country_code = Column(String, primary_key=True, index=True)
    country_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Passenger(Base):
    __tablename__ = 'passenger'

    passenger_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    date_of_birth = Column(Date)
    nationality_country_code = Column(String, ForeignKey('country.country_code'), index=True)
    phone = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    biometric_consent = Column(Boolean)
    consent_date = Column(DateTime)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class TravelDocument(Base):
    __tablename__ = 'traveldocument'

    document_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    document_type = Column(String)
    document_number = Column(String, unique=True, index=True)
    issuing_country_code = Column(String, ForeignKey('country.country_code'), index=True)
    expiry_date = Column(Date)
    mrz_hash = Column(String)
    is_primary = Column(Boolean)
    document_image_url = Column(String, nullable=True)
    created_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FaceEnrollment(Base):
    __tablename__ = 'faceenrollment'

    enrollment_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    document_id = Column(Integer, ForeignKey('traveldocument.document_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    face_embedding_ref = Column(String)
    embedding_model = Column(String)
    enrollment_time = Column(DateTime)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FaceVerificationLog(Base):
    __tablename__ = 'faceverificationlog'

    verification_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    enrollment_id = Column(Integer, ForeignKey('faceenrollment.enrollment_id'), index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.equipment_id'), index=True)
    checkpoint_type = Column(String)
    cosine_similarity = Column(DECIMAL(6,4))
    match_threshold = Column(DECIMAL(6,4))
    verification_status = Column(String)
    timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PassengerDevice(Base):
    __tablename__ = 'passengerdevice'

    device_id = Column(Integer, primary_key=True, index=True)
    passenger_id = Column(Integer, ForeignKey('passenger.passenger_id'), index=True)
    device_type = Column(String)
    push_token = Column(String)
    app_version = Column(String)
    last_active = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

