from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.devices import Equipment, EquipmentHealthCheck

class EquipmentRepository(BaseRepository[Equipment]):
    def __init__(self):
        super().__init__(Equipment)

equipment_repo = EquipmentRepository()

class EquipmentHealthCheckRepository(BaseRepository[EquipmentHealthCheck]):
    def __init__(self):
        super().__init__(EquipmentHealthCheck)

equipmenthealthcheck_repo = EquipmentHealthCheckRepository()
