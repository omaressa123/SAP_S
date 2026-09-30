from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class Zone(Base):
    __tablename__ = 'zone'

    zone_id = Column(Integer, primary_key=True, index=True)
    zone_name = Column(String)
    terminal = Column(String)
    floor_level = Column(Integer)
    capacity = Column(Integer)
    current_occupancy = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MapNode(Base):
    __tablename__ = 'mapnode'

    node_id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey('zone.zone_id'), index=True)
    node_type = Column(String)
    label = Column(String)
    x_coord = Column(DECIMAL(8,2))
    y_coord = Column(DECIMAL(8,2))
    linked_entity_type = Column(String)
    linked_entity_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MapEdge(Base):
    __tablename__ = 'mapedge'

    edge_id = Column(Integer, primary_key=True, index=True)
    from_node_id = Column(Integer, ForeignKey('mapnode.node_id'), index=True)
    to_node_id = Column(Integer, ForeignKey('mapnode.node_id'), index=True)
    distance_m = Column(DECIMAL(6,2))
    walk_time_sec = Column(Integer)
    is_accessible = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

