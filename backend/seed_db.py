from datetime import datetime, timedelta
from app.database import SessionLocal, Base, engine
from app.models.identity import Country, Passenger, TravelDocument, FaceEnrollment
from app.models.flights import Airline, Airport, Flight, Booking
from app.models.security import SecurityGate, BoardingGate, SecurityGateLog, BoardingLog
from app.models.check_in import CheckInRecord, Bag, BagCheckpointLog
from app.models.wayfinding import Zone
from app.models.devices import Equipment
from app.models.admin_cameras import Camera
from app.services.auth_service import AuthService

def seed():
    print("Creating tables if not present...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Countries
        countries = [
            ("US", "United States"),
            ("QA", "Qatar"),
            ("EG", "Egypt"),
            ("GB", "United Kingdom"),
            ("AE", "United Arab Emirates"),
            ("FR", "France"),
            ("DE", "Germany"),
        ]
        for code, name in countries:
            if not db.query(Country).filter(Country.country_code == code).first():
                db.add(Country(country_code=code, country_name=name, created_at=datetime.utcnow()))
        db.commit()

        # 2. Airlines
        airlines = [
            ("QR", "Qatar Airways"),
            ("MS", "EgyptAir"),
            ("EK", "Emirates"),
            ("BA", "British Airways"),
            ("AF", "Air France"),
        ]
        for code, name in airlines:
            if not db.query(Airline).filter(Airline.iata_code == code).first():
                db.add(Airline(name=name, iata_code=code))
        db.commit()

        # 3. Airports
        airports = [
            ("DOH", "Hamad International Airport", "Doha", "QA"),
            ("CAI", "Cairo International Airport", "Cairo", "EG"),
            ("DXB", "Dubai International Airport", "Dubai", "AE"),
            ("LHR", "Heathrow Airport", "London", "GB"),
            ("JFK", "John F. Kennedy International Airport", "New York", "US"),
            ("CDG", "Charles de Gaulle Airport", "Paris", "FR"),
        ]
        for code, name, city, ccode in airports:
            if not db.query(Airport).filter(Airport.iata_code == code).first():
                db.add(Airport(iata_code=code, city=city, country_code=ccode))
        db.commit()

        # 4. Boarding Gates & Security Gates
        gates = ["B22", "A12", "B04", "C10", "A01", "A02", "A03"]
        for g in gates:
            if not db.query(BoardingGate).filter(BoardingGate.gate_number == g).first():
                db.add(BoardingGate(gate_number=g, status="OPEN"))
        
        for sg in ["Security Gate 01 - Hall B", "Security Gate 02 - Hall B", "Security Gate 03 - FastTrack", "Security Gate 04 - Crew"]:
            if not db.query(SecurityGate).filter(SecurityGate.location == sg).first():
                db.add(SecurityGate(location=sg, status="ACTIVE"))
        db.commit()

        # 5. Zones
        zones = [
            ("Main Concourse T2", "T2", 2, 800, 320),
            ("Gate B22 Holding Area", "T2", 2, 200, 45),
            ("Security Checkpoint Alpha", "T2", 2, 300, 85),
            ("Baggage Claim Hall", "T2", 1, 600, 150),
            ("Check-in Hall West", "T2", 2, 1000, 450),
        ]
        for name, term, floor, cap, occ in zones:
            if not db.query(Zone).filter(Zone.zone_name == name).first():
                db.add(Zone(zone_name=name, terminal=term, floor_level=floor, capacity=cap, current_occupancy=occ))
        db.commit()

        # 6. Passengers
        passengers_data = [
            {
                "fullName": "Alex Mercer",
                "email": "alex.mercer@example.com",
                "passport": "P982301A",
                "country": "US",
                "dob": "1988-06-12",
                "phone": "+1-555-0199",
            },
            {
                "fullName": "Ahmed Mohamed Hassan",
                "email": "ahmed.hassan@example.com",
                "passport": "A12345678",
                "country": "EG",
                "dob": "1992-05-14",
                "phone": "+20-100-1234567",
            },
            {
                "fullName": "Elena Rostova",
                "email": "elena.rostova@example.com",
                "passport": "E7749201B",
                "country": "FR",
                "dob": "1995-11-23",
                "phone": "+33-6-12345678",
            },
            {
                "fullName": "Omar Essam",
                "email": "omar.essam@example.com",
                "passport": "O5541299C",
                "country": "EG",
                "dob": "1997-03-18",
                "phone": "+20-111-9876543",
            }
        ]

        created_passengers = []
        for pd in passengers_data:
            p = db.query(Passenger).filter(Passenger.email == pd["email"]).first()
            if not p:
                dob = datetime.strptime(pd["dob"], "%Y-%m-%d").date()
                p = Passenger(
                    full_name=pd["fullName"],
                    email=pd["email"],
                    password_hash=AuthService.get_password_hash("password123"),
                    nationality_country_code=pd["country"],
                    date_of_birth=dob,
                    phone=pd["phone"],
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(p)
                db.flush()

                doc = TravelDocument(
                    passenger_id=p.passenger_id,
                    document_type="passport",
                    document_number=pd["passport"],
                    issuing_country_code=pd["country"],
                    is_primary=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(doc)
            created_passengers.append(p)
        db.commit()

        # 7. Flights
        qr_airline = db.query(Airline).filter(Airline.iata_code == "QR").first()
        ms_airline = db.query(Airline).filter(Airline.iata_code == "MS").first()
        ek_airline = db.query(Airline).filter(Airline.iata_code == "EK").first()
        ba_airline = db.query(Airline).filter(Airline.iata_code == "BA").first()

        jfk = db.query(Airport).filter(Airport.iata_code == "JFK").first()
        doh = db.query(Airport).filter(Airport.iata_code == "DOH").first()
        cai = db.query(Airport).filter(Airport.iata_code == "CAI").first()
        dxb = db.query(Airport).filter(Airport.iata_code == "DXB").first()
        lhr = db.query(Airport).filter(Airport.iata_code == "LHR").first()

        gate_b22 = db.query(BoardingGate).filter(BoardingGate.gate_number == "B22").first()
        gate_a12 = db.query(BoardingGate).filter(BoardingGate.gate_number == "A12").first()
        gate_b04 = db.query(BoardingGate).filter(BoardingGate.gate_number == "B04").first()

        flights_data = [
            {
                "flight_number": "QR-082",
                "airline_id": qr_airline.airline_id if qr_airline else 1,
                "origin_airport_id": jfk.airport_id if jfk else 1,
                "destination_airport_id": doh.airport_id if doh else 2,
                "boarding_gate_id": gate_b22.boarding_gate_id if gate_b22 else 1,
                "scheduled_departure": datetime.utcnow().replace(hour=10, minute=45, second=0, microsecond=0),
                "status": "BOARDING"
            },
            {
                "flight_number": "MS777",
                "airline_id": ms_airline.airline_id if ms_airline else 2,
                "origin_airport_id": jfk.airport_id if jfk else 1,
                "destination_airport_id": cai.airport_id if cai else 2,
                "boarding_gate_id": gate_a12.boarding_gate_id if gate_a12 else 2,
                "scheduled_departure": datetime.utcnow() + timedelta(hours=2),
                "status": "SCHEDULED"
            },
            {
                "flight_number": "EK456",
                "airline_id": ek_airline.airline_id if ek_airline else 3,
                "origin_airport_id": jfk.airport_id if jfk else 1,
                "destination_airport_id": dxb.airport_id if dxb else 3,
                "boarding_gate_id": gate_b04.boarding_gate_id if gate_b04 else 3,
                "scheduled_departure": datetime.utcnow() + timedelta(hours=3, minutes=30),
                "status": "SCHEDULED"
            },
            {
                "flight_number": "BA789",
                "airline_id": ba_airline.airline_id if ba_airline else 4,
                "origin_airport_id": jfk.airport_id if jfk else 1,
                "destination_airport_id": lhr.airport_id if lhr else 4,
                "boarding_gate_id": gate_a12.boarding_gate_id if gate_a12 else 2,
                "scheduled_departure": datetime.utcnow() + timedelta(hours=5),
                "status": "SCHEDULED"
            }
        ]

        for fd in flights_data:
            if not db.query(Flight).filter(Flight.flight_number == fd["flight_number"]).first():
                f = Flight(
                    flight_number=fd["flight_number"],
                    airline_id=fd["airline_id"],
                    origin_airport_id=fd["origin_airport_id"],
                    destination_airport_id=fd["destination_airport_id"],
                    boarding_gate_id=fd["boarding_gate_id"],
                    scheduled_departure=fd["scheduled_departure"],
                    status=fd["status"],
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(f)
        db.commit()

        # 8. Bookings and Checked-in Bags for Alex Mercer & Ahmed Hassan
        alex = db.query(Passenger).filter(Passenger.email == "alex.mercer@example.com").first()
        qr_flight = db.query(Flight).filter(Flight.flight_number == "QR-082").first()

        if alex and qr_flight:
            b = db.query(Booking).filter(Booking.passenger_id == alex.passenger_id).first()
            if not b:
                b = Booking(
                    passenger_id=alex.passenger_id,
                    flight_id=qr_flight.flight_id,
                    booking_reference="QR-B98210",
                    seat_number="14A",
                    booking_class="business",
                    booking_status="confirmed",
                    created_at=datetime.utcnow()
                )
                db.add(b)
                db.flush()

                # Add a Bag
                bag = Bag(
                    passenger_id=alex.passenger_id,
                    booking_id=b.booking_id,
                    rfid_tag="RF-QR-14A-01",
                    qr_code="QR-BAG-98210",
                    weight_kg=22.4,
                    current_status="loaded",
                    current_location="Baggage Loading Dock - Bay 12",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(bag)
                db.flush()

                db.add(BagCheckpointLog(
                    bag_id=bag.bag_id,
                    checkpoint_type="sorting",
                    location="Baggage Loading Dock - Bay 12",
                    timestamp=datetime.utcnow()
                ))

        db.commit()
        print("Database seeded with realistic flights, passengers, gates, and luggage!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding DB: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
