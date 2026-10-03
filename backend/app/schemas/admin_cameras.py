from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class UserAccountBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    linked_person_type: Optional[str] = None
    linked_person_id: Optional[int] = None
    is_active: Optional[bool] = None
    last_login: Optional[datetime] = None

class UserAccountCreate(UserAccountBase):
    pass

class UserAccountResponse(UserAccountBase):
    user_account_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CameraBase(BaseModel):
    location: Optional[str] = None
    zone_id: Optional[int] = None
    camera_type: Optional[str] = None
    equipment_id: Optional[int] = None
    status: Optional[str] = None

class CameraCreate(CameraBase):
    pass

class CameraResponse(CameraBase):
    camera_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MonitoringAlertBase(BaseModel):
    camera_id: Optional[int] = None
    zone_id: Optional[int] = None
    behavior_type: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    linked_emergency_event_id: Optional[int] = None
    resolved_by_staff_id: Optional[int] = None
    timestamp: Optional[datetime] = None

class MonitoringAlertCreate(MonitoringAlertBase):
    pass

class MonitoringAlertResponse(MonitoringAlertBase):
    alert_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EmergencyEventBase(BaseModel):
    event_type: Optional[str] = None
    zone_id: Optional[int] = None
    notified_staff_id: Optional[int] = None
    status: Optional[str] = None
    detected_time: Optional[datetime] = None
    resolved_time: Optional[datetime] = None

class EmergencyEventCreate(EmergencyEventBase):
    pass

class EmergencyEventResponse(EmergencyEventBase):
    event_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DigitalTwinPositionBase(BaseModel):
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    x_coord: Optional[Decimal] = None
    y_coord: Optional[Decimal] = None
    z_coord: Optional[Decimal] = None
    timestamp: Optional[datetime] = None

class DigitalTwinPositionCreate(DigitalTwinPositionBase):
    pass

class DigitalTwinPositionResponse(DigitalTwinPositionBase):
    position_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    user_account_id: Optional[int] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    ip_address: Optional[str] = None
    timestamp: Optional[datetime] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    audit_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
