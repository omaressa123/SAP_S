from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class CheckInRecordBase(BaseModel):
    booking_id: Optional[int] = None
    passenger_id: Optional[int] = None
    equipment_id: Optional[int] = None
    checkin_time: Optional[datetime] = None

class CheckInRecordCreate(CheckInRecordBase):
    pass

class CheckInRecordResponse(CheckInRecordBase):
    checkin_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BagBase(BaseModel):
    booking_id: Optional[int] = None
    passenger_id: Optional[int] = None
    checkin_id: Optional[int] = None
    rfid_tag: Optional[str] = None
    qr_code: Optional[str] = None
    weight_kg: Optional[Decimal] = None
    length_cm___width_cm___height_cm: Optional[Decimal] = None
    excess_charge: Optional[Decimal] = None
    current_status: Optional[str] = None
    current_location: Optional[str] = None

class BagCreate(BagBase):
    pass

class BagResponse(BagBase):
    bag_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BagCheckpointLogBase(BaseModel):
    bag_id: Optional[int] = None
    checkpoint_type: Optional[str] = None
    equipment_id: Optional[int] = None
    location: Optional[str] = None
    timestamp: Optional[datetime] = None

class BagCheckpointLogCreate(BagCheckpointLogBase):
    pass

class BagCheckpointLogResponse(BagCheckpointLogBase):
    checkpoint_log_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
