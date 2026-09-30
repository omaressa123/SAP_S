from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.wayfinding import Zone, MapNode, MapEdge

class ZoneRepository(BaseRepository[Zone]):
    def __init__(self):
        super().__init__(Zone)

zone_repo = ZoneRepository()

class MapNodeRepository(BaseRepository[MapNode]):
    def __init__(self):
        super().__init__(MapNode)

mapnode_repo = MapNodeRepository()

class MapEdgeRepository(BaseRepository[MapEdge]):
    def __init__(self):
        super().__init__(MapEdge)

mapedge_repo = MapEdgeRepository()
