from .base import BaseRepository
from ..models.passenger import Passenger
from sqlalchemy.orm import Session

class PassengerRepository(BaseRepository[Passenger]):
    def __init__(self):
        super().__init__(Passenger)
    
    def get_by_passport(self, db: Session, passport_number: str):
        return db.query(self.model).filter(self.model.passport_number == passport_number).first()

passenger_repo = PassengerRepository()
