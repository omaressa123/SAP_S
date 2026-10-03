from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.check_in import CheckInRecord, Bag, BagCheckpointLog

class CheckInRecordRepository(BaseRepository[CheckInRecord]):
    def __init__(self):
        super().__init__(CheckInRecord)

checkinrecord_repo = CheckInRecordRepository()

class BagRepository(BaseRepository[Bag]):
    def __init__(self):
        super().__init__(Bag)

bag_repo = BagRepository()

class BagCheckpointLogRepository(BaseRepository[BagCheckpointLog]):
    def __init__(self):
        super().__init__(BagCheckpointLog)

bagcheckpointlog_repo = BagCheckpointLogRepository()
