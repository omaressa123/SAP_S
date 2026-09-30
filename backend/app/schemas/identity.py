from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class CountryBase(BaseModel):
    country_name: Optional[str] = None

class CountryCreate(CountryBase):
    pass

class CountryResponse(CountryBase):
    country_code: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PassengerBase(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    nationality_country_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    biometric_consent: Optional[bool] = None
    consent_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class PassengerCreate(PassengerBase):
    pass

class PassengerResponse(PassengerBase):
    passenger_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TravelDocumentBase(BaseModel):
    passenger_id: Optional[int] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    issuing_country_code: Optional[str] = None
    expiry_date: Optional[date] = None
    mrz_hash: Optional[str] = None
    is_primary: Optional[bool] = None

class TravelDocumentCreate(TravelDocumentBase):
    pass

class TravelDocumentResponse(TravelDocumentBase):
    document_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FaceEnrollmentBase(BaseModel):
    passenger_id: Optional[int] = None
    document_id: Optional[int] = None
    equipment_id: Optional[int] = None
    face_embedding_ref: Optional[str] = None
    embedding_model: Optional[str] = None
    enrollment_time: Optional[datetime] = None
    status: Optional[str] = None

class FaceEnrollmentCreate(FaceEnrollmentBase):
    pass

class FaceEnrollmentResponse(FaceEnrollmentBase):
    enrollment_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FaceVerificationLogBase(BaseModel):
    passenger_id: Optional[int] = None
    enrollment_id: Optional[int] = None
    equipment_id: Optional[int] = None
    checkpoint_type: Optional[str] = None
    cosine_similarity: Optional[Decimal] = None
    match_threshold: Optional[Decimal] = None
    verification_status: Optional[str] = None
    timestamp: Optional[datetime] = None

class FaceVerificationLogCreate(FaceVerificationLogBase):
    pass

class FaceVerificationLogResponse(FaceVerificationLogBase):
    verification_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PassengerDeviceBase(BaseModel):
    passenger_id: Optional[int] = None
    device_type: Optional[str] = None
    push_token: Optional[str] = None
    app_version: Optional[str] = None
    last_active: Optional[datetime] = None

class PassengerDeviceCreate(PassengerDeviceBase):
    pass

class PassengerDeviceResponse(PassengerDeviceBase):
    device_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
