from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class BaggageInspectionBase(BaseModel):
    bag_id: Optional[int] = None
    equipment_id: Optional[int] = None
    scan_time: Optional[datetime] = None
    ai_model_version: Optional[str] = None
    result: Optional[str] = None
    reviewed_by_staff_id: Optional[int] = None

class BaggageInspectionCreate(BaggageInspectionBase):
    pass

class BaggageInspectionResponse(BaggageInspectionBase):
    inspection_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DetectedItemBase(BaseModel):
    inspection_id: Optional[int] = None
    item_type: Optional[str] = None
    confidence_score: Optional[Decimal] = None

class DetectedItemCreate(DetectedItemBase):
    pass

class DetectedItemResponse(DetectedItemBase):
    item_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
