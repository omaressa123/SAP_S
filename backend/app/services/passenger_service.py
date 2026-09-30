from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..models.flights import Booking, Flight, Airline, Airport
from ..models.identity import Passenger, TravelDocument
from ..models.security import BoardingGate
from ..utils.errors import AirportException

class PassengerService:
    @staticmethod
    def link_booking(db: Session, passenger_id: int, payload):
        # Verify the passport matches the passenger profile
        travel_doc = db.query(TravelDocument).filter(
            TravelDocument.passenger_id == passenger_id,
            TravelDocument.document_number == payload.passportNumber
        ).first()
        
        if not travel_doc:
            raise AirportException(code="PASSPORT_MISMATCH", message="Passport number does not match your profile.", status_code=400)
            
        # Look for the booking in our DB
        booking = db.query(Booking).filter(Booking.booking_reference == payload.bookingReference).first()
        
        # If it doesn't exist, simulate fetching it from a Global Distribution System (GDS/PSS)
        if not booking:
            airline = db.query(Airline).filter(Airline.iata_code == "MS").first()
            if not airline:
                airline = Airline(name="EgyptAir", iata_code="MS")
                db.add(airline)
                db.flush()
                
            flight = Flight(
                flight_number="MS777",
                airline_id=airline.airline_id,
                scheduled_departure=datetime.utcnow() + timedelta(hours=3),
                status="SCHEDULED"
            )
            db.add(flight)
            db.flush()
            
            booking = Booking(
                booking_reference=payload.bookingReference,
                flight_id=flight.flight_id,
                seat_number="12A",
                booking_class="economy",
                booking_status="CONFIRMED",
                created_at=datetime.utcnow()
            )
            db.add(booking)
            db.flush()
            
        # Link to the passenger
        booking.passenger_id = passenger_id
        db.commit()
        db.refresh(booking)
        
        flight = db.query(Flight).filter(Flight.flight_id == booking.flight_id).first()
        airline = db.query(Airline).filter(Airline.airline_id == flight.airline_id).first()
        gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == flight.boarding_gate_id).first() if flight.boarding_gate_id else None
        
        return {
            "bookingId": booking.booking_id,
            "passengerId": passenger_id,
            "flightNumber": flight.flight_number,
            "airline": airline.name if airline else "Unknown",
            "seatNumber": booking.seat_number,
            "bookingClass": booking.booking_class,
            "bookingStatus": booking.booking_status,
            "scheduledDeparture": flight.scheduled_departure.isoformat() + "Z",
            "boardingGateNumber": gate.gate_number if gate else "TBD"
        }

    @staticmethod
    def get_active_flight(db: Session, passenger_id: int):
        # Get the most recent booking
        booking = db.query(Booking).filter(Booking.passenger_id == passenger_id).order_by(Booking.created_at.desc()).first()
        if not booking:
            raise AirportException(code="NO_ACTIVE_FLIGHT", message="No active flights found for this passenger.", status_code=404)
            
        flight = db.query(Flight).filter(Flight.flight_id == booking.flight_id).first()
        gate = db.query(BoardingGate).filter(BoardingGate.boarding_gate_id == flight.boarding_gate_id).first() if flight.boarding_gate_id else None
        
        return {
            "passengerId": passenger_id,
            "activeBooking": {
                "bookingId": booking.booking_id,
                "flightId": flight.flight_id,
                "flightNumber": flight.flight_number,
                "scheduledDeparture": flight.scheduled_departure.isoformat() + "Z",
                "actualDeparture": flight.actual_departure.isoformat() + "Z" if flight.actual_departure else None,
                "flightStatus": flight.status,
                "boardingGate": {
                    "boardingGateId": gate.boarding_gate_id,
                    "gateNumber": gate.gate_number,
                    "status": gate.status
                } if gate else None
            }
        }
