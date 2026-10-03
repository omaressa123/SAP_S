from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class AirlineBase(BaseModel):
    name: Optional[str] = None
    iata_code: Optional[str] = None

class AirlineCreate(AirlineBase):
    pass

class AirlineResponse(AirlineBase):
    airline_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AirportBase(BaseModel):
    iata_code: Optional[str] = None
    city: Optional[str] = None
    country_code: Optional[str] = None

class AirportCreate(AirportBase):
    pass

class AirportResponse(AirportBase):
    airport_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class FlightBase(BaseModel):
    flight_number: Optional[str] = None
    airline_id: Optional[int] = None
    origin_airport_id: Optional[int] = None
    destination_airport_id: Optional[int] = None
    scheduled_departure: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    boarding_gate_id: Optional[int] = None
    status: Optional[str] = None

class FlightCreate(FlightBase):
    pass

class FlightResponse(FlightBase):
    flight_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BookingBase(BaseModel):
    passenger_id: Optional[int] = None
    flight_id: Optional[int] = None
    booking_reference: Optional[str] = None
    seat_number: Optional[str] = None
    booking_class: Optional[str] = None
    booking_status: Optional[str] = None

class BookingCreate(BookingBase):
    pass

class BookingResponse(BookingBase):
    booking_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class NotificationBase(BaseModel):
    passenger_id: Optional[int] = None
    staff_id: Optional[int] = None
    channel: Optional[str] = None
    notification_type: Optional[str] = None
    content: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    notification_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
