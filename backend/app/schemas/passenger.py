from pydantic import BaseModel
from datetime import datetime

class PassengerBase(BaseModel):
    first_name: str
    last_name: str
    passport_number: str

class PassengerCreate(PassengerBase):
    pass

class PassengerResponse(PassengerBase):
    id: int
    biometric_registered: bool
    created_at: datetime

    class Config:
        from_attributes = True
