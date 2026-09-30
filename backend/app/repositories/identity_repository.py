from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.identity import Country, Passenger, TravelDocument, FaceEnrollment, FaceVerificationLog, PassengerDevice

class CountryRepository(BaseRepository[Country]):
    def __init__(self):
        super().__init__(Country)

country_repo = CountryRepository()

class PassengerRepository(BaseRepository[Passenger]):
    def __init__(self):
        super().__init__(Passenger)

passenger_repo = PassengerRepository()

class TravelDocumentRepository(BaseRepository[TravelDocument]):
    def __init__(self):
        super().__init__(TravelDocument)

traveldocument_repo = TravelDocumentRepository()

class FaceEnrollmentRepository(BaseRepository[FaceEnrollment]):
    def __init__(self):
        super().__init__(FaceEnrollment)

faceenrollment_repo = FaceEnrollmentRepository()

class FaceVerificationLogRepository(BaseRepository[FaceVerificationLog]):
    def __init__(self):
        super().__init__(FaceVerificationLog)

faceverificationlog_repo = FaceVerificationLogRepository()

class PassengerDeviceRepository(BaseRepository[PassengerDevice]):
    def __init__(self):
        super().__init__(PassengerDevice)

passengerdevice_repo = PassengerDeviceRepository()
