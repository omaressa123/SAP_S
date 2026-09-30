from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class PowerSourceBase(BaseModel):
    source_type: Optional[str] = None
    zone_id: Optional[int] = None
    description: Optional[str] = None

class PowerSourceCreate(PowerSourceBase):
    pass

class PowerSourceResponse(PowerSourceBase):
    source_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SolarInstallationBase(BaseModel):
    zone_id: Optional[int] = None
    equipment_id: Optional[int] = None
    capacity_kw: Optional[Decimal] = None
    panel_count: Optional[int] = None
    installed_date: Optional[date] = None
    status: Optional[str] = None

class SolarInstallationCreate(SolarInstallationBase):
    pass

class SolarInstallationResponse(SolarInstallationBase):
    installation_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EnergyGenerationLogBase(BaseModel):
    installation_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    kwh_generated: Optional[Decimal] = None

class EnergyGenerationLogCreate(EnergyGenerationLogBase):
    pass

class EnergyGenerationLogResponse(EnergyGenerationLogBase):
    log_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EnergyStorageBase(BaseModel):
    installation_id: Optional[int] = None
    capacity_kwh: Optional[Decimal] = None
    current_charge_pct: Optional[Decimal] = None
    status: Optional[str] = None
    last_updated: Optional[datetime] = None

class EnergyStorageCreate(EnergyStorageBase):
    pass

class EnergyStorageResponse(EnergyStorageBase):
    battery_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EnergyConsumptionLogBase(BaseModel):
    zone_id: Optional[int] = None
    equipment_id: Optional[int] = None
    source_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    kwh_consumed: Optional[Decimal] = None

class EnergyConsumptionLogCreate(EnergyConsumptionLogBase):
    pass

class EnergyConsumptionLogResponse(EnergyConsumptionLogBase):
    log_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
