from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.sustainability import PowerSource, SolarInstallation, EnergyGenerationLog, EnergyStorage, EnergyConsumptionLog

class PowerSourceRepository(BaseRepository[PowerSource]):
    def __init__(self):
        super().__init__(PowerSource)

powersource_repo = PowerSourceRepository()

class SolarInstallationRepository(BaseRepository[SolarInstallation]):
    def __init__(self):
        super().__init__(SolarInstallation)

solarinstallation_repo = SolarInstallationRepository()

class EnergyGenerationLogRepository(BaseRepository[EnergyGenerationLog]):
    def __init__(self):
        super().__init__(EnergyGenerationLog)

energygenerationlog_repo = EnergyGenerationLogRepository()

class EnergyStorageRepository(BaseRepository[EnergyStorage]):
    def __init__(self):
        super().__init__(EnergyStorage)

energystorage_repo = EnergyStorageRepository()

class EnergyConsumptionLogRepository(BaseRepository[EnergyConsumptionLog]):
    def __init__(self):
        super().__init__(EnergyConsumptionLog)

energyconsumptionlog_repo = EnergyConsumptionLogRepository()
