from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class EquipmentBase(BaseModel):
    equipment_type: Optional[str] = None
    label: Optional[str] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    zone_id: Optional[int] = None
    install_date: Optional[date] = None
    firmware_version: Optional[str] = None
    status: Optional[str] = None
    last_health_check: Optional[datetime] = None

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentResponse(EquipmentBase):
    equipment_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EquipmentHealthCheckBase(BaseModel):
    equipment_id: Optional[int] = None
    check_time: Optional[datetime] = None
    metric_type: Optional[str] = None
    value: Optional[Decimal] = None
    status_result: Optional[str] = None

class EquipmentHealthCheckCreate(EquipmentHealthCheckBase):
    pass

class EquipmentHealthCheckResponse(EquipmentHealthCheckBase):
    check_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
