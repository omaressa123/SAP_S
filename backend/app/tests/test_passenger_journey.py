"""End-to-End Integration Tests for Passenger Journey, QR Pairing & Expo Mobile Sync."""
import uuid
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models.flights import Airline, Airport, Booking, Flight
from app.models.identity import Country, Passenger, TravelDocument
from app.models.journey import JourneyPairingToken, JourneyTouchpointEvent, PassengerJourney
from app.models.security import BoardingGate
from app.services import journey_service as js

client = TestClient(app)
HEADERS = {"X-API-KEY": "MOCK_API_KEY_123"}


def test_end_to_end_passenger_journey_and_qr_pairing():
    db = SessionLocal()
    sfx = uuid.uuid4().hex[:6].upper()
    try:
        # 1. Seed Country, Airports, Airline, Gate B22, Flight, Passenger, Document, Booking
        if not db.query(Country).filter(Country.country_code == "EG").first():
            db.add(Country(country_code="EG", country_name="Egypt"))
        if not db.query(Country).filter(Country.country_code == "QA").first():
            db.add(Country(country_code="QA", country_name="Qatar"))

        orig = db.query(Airport).filter(Airport.iata_code == "CAI").first()
        if not orig:
            orig = Airport(iata_code="CAI", city="Cairo", country_code="EG")
            db.add(orig)
        dest = db.query(Airport).filter(Airport.iata_code == "DOH").first()
        if not dest:
            dest = Airport(iata_code="DOH", city="Doha", country_code="QA")
            db.add(dest)

        airline = db.query(Airline).filter(Airline.iata_code == "QR").first()
        if not airline:
            airline = Airline(name="Qatar Airways", iata_code="QR")
            db.add(airline)

        gate = db.query(BoardingGate).filter(BoardingGate.gate_number == "B22").first()
        if not gate:
            gate = BoardingGate(gate_number="B22", status="OPEN")
            db.add(gate)
        db.flush()

        flight = Flight(
            flight_number=f"QR-{sfx[:3]}",
            airline_id=airline.airline_id,
            origin_airport_id=orig.airport_id,
            destination_airport_id=dest.airport_id,
            scheduled_departure=datetime.utcnow() + timedelta(hours=2),
            boarding_gate_id=gate.boarding_gate_id,
            status="SCHEDULED",
        )
        db.add(flight)
        db.flush()

        pax = Passenger(
            full_name=f"Omar Journey {sfx}",
            nationality_country_code="EG",
            email=f"omar.{sfx.lower()}@example.com",
            password_hash="hashed",
            biometric_consent=True,
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(pax)
        db.flush()

        doc = TravelDocument(
            passenger_id=pax.passenger_id,
            document_type="Passport",
            document_number=f"P{sfx}99",
            issuing_country_code="EG",
            is_primary=True,
        )
        db.add(doc)

        booking = Booking(
            passenger_id=pax.passenger_id,
            flight_id=flight.flight_id,
            booking_reference=f"PNR-{sfx}",
            seat_number="14A",
            booking_class="Business",
            booking_status="confirmed",
        )
        db.add(booking)
        db.commit()

        pax_id = pax.passenger_id
        booking_id = booking.booking_id
        flight_id = flight.flight_id
        flight_num = flight.flight_number
    finally:
        db.close()

    # 2. eKiosk Check-in -> generates real journey + boarding pass + one-time QR pairing token
    chk = client.post(
        "/api/v1/kiosk/boarding-pass/issue",
        json={"bookingId": booking_id, "passengerId": pax_id, "kioskEquipmentId": 4, "bagsToRegisterCount": 1},
        headers=HEADERS,
    )
    assert chk.status_code == 200
    chk_data = chk.json()["data"]
    qr_payload = chk_data["pairingQrPayload"]
    journey_id = chk_data["journeyId"]
    assert qr_payload.startswith("SA-PAIR:")
    assert f"P{sfx}99" not in qr_payload  # No PII in QR

    # 3. Invalid QR token rejected
    bad_qr = client.post("/api/v1/journey/pair/claim", json={"token": "SA-PAIR:invalid-xyz", "device_uuid": "dev-1"})
    assert bad_qr.status_code == 400
    assert bad_qr.json()["error"]["code"] == "INVALID_QR_TOKEN"

    # 4. Expo App claims QR token
    claim = client.post(
        "/api/v1/journey/pair/claim",
        json={"token": qr_payload, "device_uuid": "expo-device-001", "push_token": "ExponentPushToken[abc]"},
    )
    assert claim.status_code == 200
    claim_data = claim.json()["data"]
    jwt = claim_data["access_token"]
    assert claim_data["journey"]["passenger"]["passenger_id"] == pax_id
    assert claim_data["journey"]["flight"]["flight_number"] == flight_num
    assert claim_data["journey"]["flight"]["boarding_gate"] == "B22"
    assert claim_data["journey"]["booking"]["booking_reference"] == f"PNR-{sfx}"
    assert claim_data["journey"]["passenger"]["document_number_masked"].endswith("99")

    # 5. QR reuse rejected
    reuse = client.post("/api/v1/journey/pair/claim", json={"token": qr_payload, "device_uuid": "expo-device-002"})
    assert reuse.status_code == 400
    assert reuse.json()["error"]["code"] == "QR_ALREADY_USED"

    # 6. Expired QR rejected
    db = SessionLocal()
    try:
        j_row = db.query(PassengerJourney).filter(PassengerJourney.journey_id == journey_id).first()
        exp_tok = js.generate_pairing_token(db, j_row, ttl_minutes=-5)
        db.commit()
        exp_str = f"SA-PAIR:{exp_tok.token}"
    finally:
        db.close()
    exp_res = client.post("/api/v1/journey/pair/claim", json={"token": exp_str, "device_uuid": "expo-device-003"})
    assert exp_res.status_code == 400
    assert exp_res.json()["error"]["code"] == "EXPIRED_QR_TOKEN"

    # 7. Baggage Drop (issue tag + dispatch)
    tag_res = client.post(
        "/api/v1/baggage-drop/issue-tag",
        json={"passengerId": pax_id, "bookingId": booking_id, "flightNumber": flight_num, "weightKg": 21.5, "bagIndex": 1, "totalBags": 1},
        headers=HEADERS,
    )
    assert tag_res.status_code == 200
    bag_id = tag_res.json()["data"]["bagId"]

    disp_res = client.post(
        "/api/v1/baggage-drop/dispatch",
        json={"passengerId": pax_id, "bagId": bag_id},
        headers=HEADERS,
    )
    assert disp_res.status_code == 200

    # 8. Security Gate
    sec_res = client.post("/api/v1/security-gate/verify", json={"passengerId": pax_id, "gateId": 2}, headers=HEADERS)
    assert sec_res.status_code == 200
    assert sec_res.json()["data"]["authorizationResult"] == "authorized"

    # 9. Boarding Gate B22 + Boarding Confirmation
    brd_res = client.post(
        "/api/v1/boarding-gate/verify-and-board",
        json={"passengerId": pax_id, "boardingGateId": gate.boarding_gate_id, "flightNumber": flight_num, "scenarioState": 2},
        headers=HEADERS,
    )
    assert brd_res.status_code == 200
    assert brd_res.json()["data"]["cleared"] is True

    # 10. Flight Departed -> Landed
    dep_res = client.patch(f"/api/v1/flights/{flight_id}/status", json={"status": "DEPARTED"}, headers=HEADERS)
    assert dep_res.status_code == 200
    arr_res = client.patch(f"/api/v1/flights/{flight_id}/status", json={"status": "LANDED"}, headers=HEADERS)
    assert arr_res.status_code == 200

    # 11. Carousel assignment + Baggage Collection -> Journey Completed
    car_res = client.post(
        "/api/v1/baggage-tracking/checkpoint",
        json={"bagId": bag_id, "checkpointType": "transferred_to_carousel", "location": "Carousel 4"},
        headers=HEADERS,
    )
    assert car_res.status_code == 201

    col_res = client.post(
        "/api/v1/journey/baggage/collect",
        json={"journey_id": journey_id, "bag_id": bag_id, "carousel": "Carousel 4"},
        headers=HEADERS,
    )
    assert col_res.status_code == 200

    # 12. Duplicate touchpoint idempotency check
    tp1 = client.post("/api/v1/journey/touchpoint", json={"journey_id": journey_id, "stage": "security_gate", "idempotency_key": f"idem-{sfx}"}, headers=HEADERS)
    tp2 = client.post("/api/v1/journey/touchpoint", json={"journey_id": journey_id, "stage": "security_gate", "idempotency_key": f"idem-{sfx}"}, headers=HEADERS)
    assert tp1.json()["data"]["event_id"] == tp2.json()["data"]["event_id"]

    # 13. Mobile app fetches final authoritative journey via Bearer JWT
    me = client.get("/api/v1/journey/me", headers={"Authorization": f"Bearer {jwt}"})
    assert me.status_code == 200
    final_j = me.json()["data"]
    assert final_j["journey_status"] == "completed"
    assert final_j["current_stage"] == "journey_completed"
    assert final_j["baggage_carousel"] == "Carousel 4"
    assert final_j["bags"][0]["status"] == "Collected"
    assert all(step["status"] == "completed" for step in final_j["timeline"])
