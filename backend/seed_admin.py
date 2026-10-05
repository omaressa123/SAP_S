from datetime import datetime
from app.database import SessionLocal, Base, engine
from app.models import identity, flights, check_in, baggage_security_screening, security, wayfinding, staff, admin_cameras, devices, sustainability
from app.models.identity import Passenger, TravelDocument, Country
from app.services.auth_service import AuthService

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    if not db.query(Country).filter(Country.country_code == "EG").first():
        db.add(Country(country_code="EG", country_name="Egypt", created_at=datetime.utcnow()))
        db.commit()
    if db.query(Passenger).filter(Passenger.email == "admin").first():
        print("admin already exists")
    else:
        p = Passenger(
            full_name="Admin",
            email="admin",
            password_hash=AuthService.get_password_hash("admin123*"),
            nationality_country_code="EG",
            date_of_birth=datetime(1990, 1, 1).date(),
            phone="0000000000",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(p)
        db.flush()
        db.add(TravelDocument(passenger_id=p.passenger_id, document_type="PASSPORT", document_number="ADMIN001", issuing_country_code="EG", expiry_date=datetime(2030, 1, 1).date(), created_at=datetime.utcnow()))
        db.commit()
        print("admin user created")
finally:
    db.close()
