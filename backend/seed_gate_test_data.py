"""
Seed Gate B22 and Gate C14 test data for Gate Boarding verification.
Ensures:
1. Concourse B & Concourse C zones exist.
2. Gate B22 (flight QR-082) & Gate C14 (flight EK-204) exist in boardinggate.
3. Flight QR-082 (Doha DOH) & Flight EK-204 (Dubai DXB) exist in flight.
4. Passenger 4 (Yehia) is booked on QR-082 (Seat 24A, Zone 2).
5. Passenger Alex Smith is booked on EK-204 (Seat 12B, Gate C14).
6. Real FaceEnrollment records with valid photo files in /data/faces/.
"""
from datetime import datetime, timedelta
import os
import sys
import base64
sys.path.insert(0, ".")

from app.database import SessionLocal
from app.models.identity import Passenger, TravelDocument, FaceEnrollment
from app.models.flights import Flight, Booking, Airline, Airport
from app.models.security import BoardingGate
from app.models.wayfinding import Zone

db = SessionLocal()

try:
    now = datetime.utcnow()

    # 1. Ensure Zone exists (using correct Zone columns: zone_name, terminal, floor_level)
    zone_b = db.query(Zone).filter(Zone.zone_name.ilike("%concourse b%")).first()
    if not zone_b:
        zone_b = db.query(Zone).filter(Zone.zone_name.ilike("%gate b%")).first()
    if not zone_b:
        zone_b = Zone(zone_name="Concourse B Gates", terminal="Terminal 2", floor_level=2, capacity=1000, current_occupancy=120)
        db.add(zone_b)
        db.commit()
        db.refresh(zone_b)
    print(f"Zone B ID: {zone_b.zone_id} ({zone_b.zone_name})")

    zone_c = db.query(Zone).filter(Zone.zone_name.ilike("%concourse c%")).first()
    if not zone_c:
        zone_c = Zone(zone_name="Concourse C Gates", terminal="Terminal 2", floor_level=2, capacity=1000, current_occupancy=85)
        db.add(zone_c)
        db.commit()
        db.refresh(zone_c)
    print(f"Zone C ID: {zone_c.zone_id} ({zone_c.zone_name})")

    # 2. Ensure Gates B22 and C14 exist in boardinggate
    gate_b22 = db.query(BoardingGate).filter(BoardingGate.gate_number == "B22").first()
    if not gate_b22:
        gate_b22 = BoardingGate(gate_number="B22", zone_id=zone_b.zone_id, equipment_id=4, status="open", created_at=now, updated_at=now)
        db.add(gate_b22)
        db.commit()
        db.refresh(gate_b22)
    print(f"Gate B22 ID: {gate_b22.boarding_gate_id}")

    gate_c14 = db.query(BoardingGate).filter(BoardingGate.gate_number == "C14").first()
    if not gate_c14:
        gate_c14 = BoardingGate(gate_number="C14", zone_id=zone_c.zone_id, equipment_id=4, status="open", created_at=now, updated_at=now)
        db.add(gate_c14)
        db.commit()
        db.refresh(gate_c14)
    print(f"Gate C14 ID: {gate_c14.boarding_gate_id}")

    # 3. Ensure Airports & Airlines
    qr_air = db.query(Airline).filter(Airline.iata_code == "QR").first()
    if not qr_air:
        qr_air = Airline(name="Qatar Airways", iata_code="QR")
        db.add(qr_air)
        db.commit()
        db.refresh(qr_air)

    ek_air = db.query(Airline).filter(Airline.iata_code == "EK").first()
    if not ek_air:
        ek_air = Airline(name="Emirates", iata_code="EK")
        db.add(ek_air)
        db.commit()
        db.refresh(ek_air)

    doh_apt = db.query(Airport).filter(Airport.iata_code == "DOH").first()
    if not doh_apt:
        doh_apt = Airport(iata_code="DOH", city="Doha", country_code="QA")
        db.add(doh_apt)
        db.commit()
        db.refresh(doh_apt)

    dxb_apt = db.query(Airport).filter(Airport.iata_code == "DXB").first()
    if not dxb_apt:
        dxb_apt = Airport(iata_code="DXB", city="Dubai", country_code="AE")
        db.add(dxb_apt)
        db.commit()
        db.refresh(dxb_apt)

    # 4. Ensure Flight QR-082 (Gate B22) & EK-204 (Gate C14)
    fl_qr082 = db.query(Flight).filter(Flight.flight_number == "QR-082").first()
    if not fl_qr082:
        fl_qr082 = Flight(
            flight_number="QR-082",
            airline_id=qr_air.airline_id,
            origin_airport_id=doh_apt.airport_id,
            destination_airport_id=doh_apt.airport_id,
            scheduled_departure=now + timedelta(hours=2),
            boarding_gate_id=gate_b22.boarding_gate_id,
            status="BOARDING",
            created_at=now,
            updated_at=now
        )
        db.add(fl_qr082)
        db.commit()
        db.refresh(fl_qr082)
    else:
        fl_qr082.boarding_gate_id = gate_b22.boarding_gate_id
        fl_qr082.status = "BOARDING"
        db.commit()
    print(f"Flight QR-082 ID: {fl_qr082.flight_id}")

    fl_ek204 = db.query(Flight).filter(Flight.flight_number == "EK-204").first()
    if not fl_ek204:
        fl_ek204 = Flight(
            flight_number="EK-204",
            airline_id=ek_air.airline_id,
            origin_airport_id=dxb_apt.airport_id,
            destination_airport_id=dxb_apt.airport_id,
            scheduled_departure=now + timedelta(hours=1),
            boarding_gate_id=gate_c14.boarding_gate_id,
            status="BOARDING",
            created_at=now,
            updated_at=now
        )
        db.add(fl_ek204)
        db.commit()
        db.refresh(fl_ek204)
    else:
        fl_ek204.boarding_gate_id = gate_c14.boarding_gate_id
        fl_ek204.status = "BOARDING"
        db.commit()
    print(f"Flight EK-204 ID: {fl_ek204.flight_id}")

    # 5. Create local test face image files on disk so URLs are 100% valid
    faces_dir = os.path.join(os.path.dirname(__file__), "data", "faces")
    os.makedirs(faces_dir, exist_ok=True)

    # 1x1 minimal sample valid JPEG if file doesn't exist
    sample_jpeg_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    p4_face_path = os.path.join(faces_dir, "p_4_face.jpg")
    alex_face_path = os.path.join(faces_dir, "p_alex_face.jpg")

    if not os.path.exists(p4_face_path):
        with open(p4_face_path, "wb") as f:
            f.write(base64.b64decode(sample_jpeg_b64))

    if not os.path.exists(alex_face_path):
        with open(alex_face_path, "wb") as f:
            f.write(base64.b64decode(sample_jpeg_b64))

    # 6. Link Passenger 4 (Yehia) to Flight QR-082
    p4 = db.query(Passenger).filter(Passenger.passenger_id == 4).first()
    if p4:
        b4 = db.query(Booking).filter(Booking.passenger_id == 4).first()
        if not b4:
            b4 = Booking(
                passenger_id=4,
                flight_id=fl_qr082.flight_id,
                booking_reference="QR82-YEHIA-24A",
                seat_number="24A",
                booking_class="Economy",
                booking_status="confirmed",
                created_at=now,
                updated_at=now
            )
            db.add(b4)
        else:
            b4.flight_id = fl_qr082.flight_id
            b4.seat_number = "24A"
            b4.booking_reference = "QR82-YEHIA-24A"

        # Ensure FaceEnrollment for Passenger 4
        doc4 = db.query(TravelDocument).filter(TravelDocument.passenger_id == 4).first()
        fe4 = db.query(FaceEnrollment).filter(FaceEnrollment.passenger_id == 4).first()
        p4_face_url = "/data/faces/p_4_face.jpg"
        if not fe4:
            fe4 = FaceEnrollment(
                passenger_id=4,
                document_id=doc4.document_id if doc4 else None,
                equipment_id=4,
                face_embedding_ref=p4_face_url,
                embedding_model="ArcFace",
                enrollment_time=now,
                status="active",
                created_at=now,
                updated_at=now
            )
            db.add(fe4)
        else:
            fe4.face_embedding_ref = p4_face_url
            fe4.status = "active"
            fe4.updated_at = now

        db.commit()
        print("Passenger 4 (Yehia) enrolled and booked on QR-082 Gate B22!")

    # 7. Create Alex Smith for EK-204 (Wrong Gate Scenario)
    p_alex = db.query(Passenger).filter(Passenger.full_name == "MR. ALEX SMITH").first()
    if not p_alex:
        p_alex = Passenger(
            full_name="MR. ALEX SMITH",
            email="alex.smith@example.com",
            nationality_country_code="US",
            password_hash="pass_alex",
            biometric_consent=True,
            consent_date=now,
            is_active=True,
            created_at=now,
            updated_at=now
        )
        db.add(p_alex)
        db.commit()
        db.refresh(p_alex)

        doc_alex = TravelDocument(
            passenger_id=p_alex.passenger_id,
            document_type="passport",
            document_number="P771928X",
            issuing_country_code="US",
            is_primary=True,
            created_at=now,
            updated_at=now
        )
        db.add(doc_alex)
        db.commit()
        db.refresh(doc_alex)

        b_alex = Booking(
            passenger_id=p_alex.passenger_id,
            flight_id=fl_ek204.flight_id,
            booking_reference="EK204-ALEX-12B",
            seat_number="12B",
            booking_class="Economy",
            booking_status="confirmed",
            created_at=now,
            updated_at=now
        )
        db.add(b_alex)

        fe_alex = FaceEnrollment(
            passenger_id=p_alex.passenger_id,
            document_id=doc_alex.document_id,
            equipment_id=4,
            face_embedding_ref="/data/faces/p_alex_face.jpg",
            embedding_model="ArcFace",
            enrollment_time=now,
            status="active",
            created_at=now,
            updated_at=now
        )
        db.add(fe_alex)
        db.commit()
        print(f"Passenger Alex Smith (ID: {p_alex.passenger_id}) created on EK-204 Gate C14!")

    print("Gate test data seeded successfully!")
finally:
    db.close()
