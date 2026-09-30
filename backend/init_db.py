from app.database import Base, engine
from app.models import identity, flights, check_in, baggage_security_screening, security, wayfinding, staff, admin_cameras, devices, sustainability

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Database initialized successfully!")
