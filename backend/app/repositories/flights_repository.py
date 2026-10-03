from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.flights import Airline, Airport, Flight, Booking, Notification

class AirlineRepository(BaseRepository[Airline]):
    def __init__(self):
        super().__init__(Airline)

airline_repo = AirlineRepository()

class AirportRepository(BaseRepository[Airport]):
    def __init__(self):
        super().__init__(Airport)

airport_repo = AirportRepository()

class FlightRepository(BaseRepository[Flight]):
    def __init__(self):
        super().__init__(Flight)

flight_repo = FlightRepository()

class BookingRepository(BaseRepository[Booking]):
    def __init__(self):
        super().__init__(Booking)

booking_repo = BookingRepository()

class NotificationRepository(BaseRepository[Notification]):
    def __init__(self):
        super().__init__(Notification)

notification_repo = NotificationRepository()
