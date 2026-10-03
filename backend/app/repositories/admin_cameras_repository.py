from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.admin_cameras import UserAccount, Camera, MonitoringAlert, EmergencyEvent, DigitalTwinPosition, AuditLog

class UserAccountRepository(BaseRepository[UserAccount]):
    def __init__(self):
        super().__init__(UserAccount)

useraccount_repo = UserAccountRepository()

class CameraRepository(BaseRepository[Camera]):
    def __init__(self):
        super().__init__(Camera)

camera_repo = CameraRepository()

class MonitoringAlertRepository(BaseRepository[MonitoringAlert]):
    def __init__(self):
        super().__init__(MonitoringAlert)

monitoringalert_repo = MonitoringAlertRepository()

class EmergencyEventRepository(BaseRepository[EmergencyEvent]):
    def __init__(self):
        super().__init__(EmergencyEvent)

emergencyevent_repo = EmergencyEventRepository()

class DigitalTwinPositionRepository(BaseRepository[DigitalTwinPosition]):
    def __init__(self):
        super().__init__(DigitalTwinPosition)

digitaltwinposition_repo = DigitalTwinPositionRepository()

class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self):
        super().__init__(AuditLog)

auditlog_repo = AuditLogRepository()
