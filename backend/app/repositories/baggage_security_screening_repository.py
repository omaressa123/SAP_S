from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.baggage_security_screening import BaggageInspection, DetectedItem

class BaggageInspectionRepository(BaseRepository[BaggageInspection]):
    def __init__(self):
        super().__init__(BaggageInspection)

baggageinspection_repo = BaggageInspectionRepository()

class DetectedItemRepository(BaseRepository[DetectedItem]):
    def __init__(self):
        super().__init__(DetectedItem)

detecteditem_repo = DetectedItemRepository()
