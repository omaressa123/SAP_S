from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.security import SecurityGate, SecurityGateLog, BoardingGate, BoardingLog

class SecurityGateRepository(BaseRepository[SecurityGate]):
    def __init__(self):
        super().__init__(SecurityGate)

securitygate_repo = SecurityGateRepository()

class SecurityGateLogRepository(BaseRepository[SecurityGateLog]):
    def __init__(self):
        super().__init__(SecurityGateLog)

securitygatelog_repo = SecurityGateLogRepository()

class BoardingGateRepository(BaseRepository[BoardingGate]):
    def __init__(self):
        super().__init__(BoardingGate)

boardinggate_repo = BoardingGateRepository()

class BoardingLogRepository(BaseRepository[BoardingLog]):
    def __init__(self):
        super().__init__(BoardingLog)

boardinglog_repo = BoardingLogRepository()
