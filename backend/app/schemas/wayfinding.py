from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class ZoneBase(BaseModel):
    zone_name: Optional[str] = None
    terminal: Optional[str] = None
    floor_level: Optional[int] = None
    capacity: Optional[int] = None
    current_occupancy: Optional[int] = None

class ZoneCreate(ZoneBase):
    pass

class ZoneResponse(ZoneBase):
    zone_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MapNodeBase(BaseModel):
    zone_id: Optional[int] = None
    node_type: Optional[str] = None
    label: Optional[str] = None
    x_coord: Optional[Decimal] = None
    y_coord: Optional[Decimal] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[int] = None

class MapNodeCreate(MapNodeBase):
    pass

class MapNodeResponse(MapNodeBase):
    node_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MapEdgeBase(BaseModel):
    from_node_id: Optional[int] = None
    to_node_id: Optional[int] = None
    distance_m: Optional[Decimal] = None
    walk_time_sec: Optional[int] = None
    is_accessible: Optional[bool] = None

class MapEdgeCreate(MapEdgeBase):
    pass

class MapEdgeResponse(MapEdgeBase):
    edge_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
