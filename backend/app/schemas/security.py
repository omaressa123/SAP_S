from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class SecurityGateBase(BaseModel):
    location: Optional[str] = None
    zone_id: Optional[int] = None
    equipment_id: Optional[int] = None
    status: Optional[str] = None

class SecurityGateCreate(SecurityGateBase):
    pass

class SecurityGateResponse(SecurityGateBase):
    gate_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SecurityGateLogBase(BaseModel):
    passenger_id: Optional[int] = None
    gate_id: Optional[int] = None
    verification_id: Optional[int] = None
    authorization_result: Optional[str] = None
    gate_opened: Optional[bool] = None
    timestamp: Optional[datetime] = None

class SecurityGateLogCreate(SecurityGateLogBase):
    pass

class SecurityGateLogResponse(SecurityGateLogBase):
    gate_log_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BoardingGateBase(BaseModel):
    gate_number: Optional[str] = None
    zone_id: Optional[int] = None
    equipment_id: Optional[int] = None
    status: Optional[str] = None

class BoardingGateCreate(BoardingGateBase):
    pass

class BoardingGateResponse(BoardingGateBase):
    boarding_gate_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BoardingLogBase(BaseModel):
    passenger_id: Optional[int] = None
    flight_id: Optional[int] = None
    boarding_gate_id: Optional[int] = None
    verification_id: Optional[int] = None
    boarding_status: Optional[str] = None
    timestamp: Optional[datetime] = None

class BoardingLogCreate(BoardingLogBase):
    pass

class BoardingLogResponse(BoardingLogBase):
    boarding_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
