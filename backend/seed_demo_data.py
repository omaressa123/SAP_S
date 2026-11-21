"""Seed realistic interconnected Smart Airport demo data into PostgreSQL.

Target database: ``smart_airport`` (PostgreSQL, psycopg driver).
Source of truth: SQLAlchemy models in ``app.models`` (numeric integer PKs
everywhere; business identifiers live in separate unique columns).

Idempotency: every row is get-or-created by its natural unique key
(email, document_number, rfid_tag, booking_reference, serial_number, ...),
so re-running never duplicates. No explicit PK values are ever set --
PostgreSQL sequences/identity always generate IDs.

Usage:
    python seed_demo_data.py            # seed (idempotent)
    python seed_demo_data.py --stats    # print per-table row counts
    python seed_demo_data.py --reset    # delete ONLY demo seed rows, then exit
    python seed_demo_data.py --seed     # same as default (explicit)

Demo-row markers (used by --reset):
    emails end with @demo.airport, booking refs start with 'DEMO',
    rfid tags start with 'RFDEMO', serials contain 'SN-DEMO'.
    Child rows are located via their demo parents (passenger/bag/equipment).
"""

import argparse
import random
import sys
from datetime import datetime, timedelta, date

sys.path.insert(0, ".")  # allow `python seed_demo_data.py` from backend/

from sqlalchemy import func  # noqa: E402

from app.database import Base, engine, SessionLocal  # noqa: E402
from app.models import (  # noqa: E402,F401 (register all tables)
    identity, flights, check_in, baggage_security_screening, security,
    wayfinding, staff, admin_cameras, devices, sustainability,
)
from app.services.auth_service import AuthService  # noqa: E402

RNG = random.Random(20261006)
NOW = datetime.utcnow().replace(microsecond=0)
DAY = timedelta(days=1)

DEMO_EMAIL_DOMAIN = "@demo.airport"

# ---------------------------------------------------------------- reference
COUNTRIES = [
    ("US", "United States"), ("QA", "Qatar"), ("EG", "Egypt"),
    ("GB", "United Kingdom"), ("AE", "United Arab Emirates"),
    ("FR", "France"), ("DE", "Germany"), ("IN", "India"),
    ("SA", "Saudi Arabia"), ("TR", "Turkey"), ("GR", "Greece"),
    ("IT", "Italy"),
]
AIRLINES = [
    ("Qatar Airways", "QR"), ("EgyptAir", "MS"), ("Emirates", "EK"),
    ("British Airways", "BA"), ("Air France", "AF"), ("Lufthansa", "LH"),
]
AIRPORTS = [
    ("DOH", "Doha", "QA"), ("CAI", "Cairo", "EG"), ("DXB", "Dubai", "AE"),
    ("LHR", "London", "GB"), ("JFK", "New York", "US"), ("CDG", "Paris", "FR"),
    ("FRA", "Frankfurt", "DE"), ("IST", "Istanbul", "TR"),
]
DEPARTMENTS = [
    ("Security", "Terminal security operations"),
    ("Baggage Handling", "Baggage sortation and loading"),
    ("Customer Service", "Passenger assistance"),
    ("Maintenance", "Equipment and facilities"),
    ("Operations", "Flight and gate operations"),
    ("IT", "Systems and infrastructure"),
]
ROLES = [
    ("security_officer", "Security screening staff"),
    ("baggage_handler", "Baggage handling staff"),
    ("gate_agent", "Boarding gate staff"),
    ("supervisor", "Shift supervisor"),
    ("admin", "System administrator"),
]
PERMISSIONS = [
    ("pax.view", "passenger_data", "View passenger data"),
    ("pax.edit", "passenger_data", "Edit passenger data"),
    ("sec.screen", "security", "Operate security screening"),
    ("sec.override", "security", "Override security decisions"),
    ("bag.track", "baggage", "Track baggage"),
    ("bag.inspect", "baggage", "Inspect baggage"),
    ("fac.energy", "facilities", "Manage energy systems"),
    ("staff.manage", "staff_admin", "Manage staff records"),
    ("energy.view", "energy", "View energy dashboards"),
    ("audit.export", "staff_admin", "Export audit logs"),
]
ZONES = [
    ("Check-in Hall West", "T2", 2, 1000),
    ("Security Checkpoint Alpha", "T2", 2, 300),
    ("Security Checkpoint Bravo", "T2", 2, 300),
    ("Main Concourse T2", "T2", 2, 800),
    ("Gate A Holding Area", "T2", 2, 250),
    ("Gate B Holding Area", "T2", 2, 250),
    ("Baggage Claim Hall", "T2", 1, 600),
    ("Baggage Sorting Hall", "T2", 0, 400),
    ("Arrivals Lobby", "T2", 1, 500),
    ("Solar Farm Roof", "T2", 3, 50),
]
BOARDING_GATES = ["A01", "A02", "A03", "A04", "A05",
                  "B01", "B02", "B03", "B04", "B05"]
SECURITY_GATES = [f"Security Gate {i:02d} - Hall {'AB'[i % 2]}" for i in range(1, 9)]

PASSENGERS = [
    ("Layla Hassan", "EG", "1990-04-12", "+20-100-1111111"),
    ("Omar Farouk", "EG", "1985-09-03", "+20-101-2222222"),
    ("Sophie Martin", "FR", "1993-01-27", "+33-6-11111111"),
    ("James Carter", "US", "1988-06-12", "+1-555-0101001"),
    ("Aisha Khan", "IN", "1995-11-23", "+91-98-11111111"),
    ("Mohammed Al-Farsi", "QA", "1982-02-14", "+974-55111111"),
    ("Elena Papadopoulos", "GR", "1991-07-08", "+30-69-11111111"),
    ("Marco Rossi", "IT", "1987-12-01", "+39-34-11111111"),
    ("Fatima Al-Sayed", "QA", "1994-05-19", "+974-55222222"),
    ("David Smith", "GB", "1979-10-30", "+44-77-11111111"),
    ("Priya Sharma", "IN", "1996-03-15", "+91-98-22222222"),
    ("Hans Mueller", "DE", "1984-08-22", "+49-17-11111111"),
    ("Sara Mahmoud", "EG", "1992-12-05", "+20-102-3333333"),
    ("John Williams", "US", "1975-04-17", "+1-555-0101002"),
    ("Yuki Tanaka", "US", "1990-09-09", "+1-555-0101003"),
    ("Ahmed Khalil", "SA", "1989-06-25", "+966-55-1111111"),
    ("Marie Dubois", "FR", "1997-02-11", "+33-6-22222222"),
    ("Ali Reza", "TR", "1986-11-02", "+90-53-11111111"),
    ("Nour El-Din", "EG", "1999-07-30", "+20-103-4444444"),
    ("Emma Wilson", "GB", "1993-12-19", "+44-77-22222222"),
    ("Khalid Mansour", "QA", "1981-05-06", "+974-55333333"),
    ("Julia Schmidt", "DE", "1994-09-14", "+49-17-22222222"),
    ("Rania Adel", "EG", "1988-01-08", "+20-104-5555555"),
    ("Chris Evans", "US", "1991-10-21", "+1-555-0101004"),
    ("Mona Aziz", "EG", "1996-06-17", "+20-105-6666666"),
]

FLIGHT_STATUSES = (["scheduled"] * 10 + ["boarding"] * 4 + ["departed"] * 4
                   + ["delayed"] * 3 + ["cancelled"] * 3)  # 24 flights
FLIGHT_NUMS = [f"{c}-{n:03d}" for c, n in
               [("QR", 102), ("QR", 104), ("QR", 106), ("QR", 108),
                ("MS", 777), ("MS", 779), ("MS", 781), ("MS", 783),
                ("EK", 456), ("EK", 458), ("EK", 460), ("EK", 462),
                ("BA", 789), ("BA", 791), ("BA", 793),
                ("AF", 321), ("AF", 323), ("AF", 325),
                ("LH", 601), ("LH", 603), ("LH", 605), ("LH", 607),
                ("QR", 110), ("MS", 785)]]

ITEM_TYPES = ["knife", "gun", "liquid", "laptop",
              "power_bank", "battery", "aerosol"]
BEHAVIORS = ["running", "fall", "overcrowding",
             "unattended_bag", "restricted_area", "loitering"]


# ------------------------------------------------------------------ helpers
def get_or_create(db, model, defaults=None, **filters):
    obj = db.query(model).filter_by(**filters).first()
    if obj:
        return obj, False
    obj = model(**filters, **(defaults or {}))
    db.add(obj)
    db.flush()
    return obj, True


def slug_name(name, i):
    base = name.lower().replace(" ", ".").replace("-", "")
    return f"{base}{i}{DEMO_EMAIL_DOMAIN}"


# --------------------------------------------------------------- seed steps
def seed_reference(db):
    for code, name in COUNTRIES:
        get_or_create(db, identity.Country, {"country_name": name},
                      country_code=code)
    for name, code in AIRLINES:
        get_or_create(db, flights.Airline, {}, name=name, iata_code=code)
    for code, city, cc in AIRPORTS:
        get_or_create(db, flights.Airport, {"city": city, "country_code": cc},
                      iata_code=code)
    for name, desc in DEPARTMENTS:
        get_or_create(db, staff.Department, {"description": desc},
                      department_name=name)
    for name, desc in ROLES:
        get_or_create(db, staff.Role, {"description": desc}, role_name=name)
    for code, cat, desc in PERMISSIONS:
        get_or_create(db, staff.Permission,
                      {"category": cat, "description": desc},
                      permission_code=code)
    db.commit()


def seed_staff(db):
    dept_ids = [d.department_id for d in db.query(staff.Department).all()]
    roles = db.query(staff.Role).all()
    perms = db.query(staff.Permission).all()
    for r in roles:  # every role gets 2 deterministic permissions
        for p in perms[r.role_id % len(perms)::len(roles)][:2]:
            get_or_create(db, staff.RolePermission, {},
                          role_id=r.role_id, permission_id=p.permission_id)
    job_titles = ["Security Officer", "Baggage Handler", "Gate Agent",
                  "Supervisor", "Maintenance Tech", "IT Support"]
    shifts = ["morning", "evening", "night", "rotating"]
    staff_rows = []
    for i in range(12):
        s, _ = get_or_create(
            db, staff.Staff,
            {"department_id": dept_ids[i % len(dept_ids)],
             "job_title": job_titles[i % len(job_titles)],
             "employment_type": "full_time",
             "shift": shifts[i % len(shifts)],
             "contact": f"+20-200-00000{i + 1:02d}",
             "hire_date": (NOW - timedelta(days=400 + i * 30)).date(),
             "is_active": True},
            full_name=f"Staff Member {i + 1:02d}")
        staff_rows.append(s)
        r = roles[i % len(roles)]
        get_or_create(db, staff.StaffRole,
                      {"assigned_date": (NOW - timedelta(days=300)).date()},
                      staff_id=s.staff_id, role_id=r.role_id)
    for i, (dog, breed, spec) in enumerate(
            [("Rex", "German Shepherd", "explosives"),
             ("Luna", "Belgian Malinois", "narcotics"),
             ("Max", "Labrador", "general_patrol"),
             ("Zara", "German Shepherd", "explosives")]):
        get_or_create(db, staff.K9Unit,
                      {"breed": breed, "specialty": spec,
                       "handler_staff_id": staff_rows[i].staff_id,
                       "status": "active",
                       "certification_expiry": (NOW + timedelta(days=200)).date()},
                      dog_name=dog)
    # user accounts: 3 staff-linked + 3 passenger-linked (linked later)
    for i in range(3):
        get_or_create(
            db, admin_cameras.UserAccount,
            {"email": f"staff{i + 1}{DEMO_EMAIL_DOMAIN}",
             "password_hash": AuthService.get_password_hash("Staff123!"),
             "linked_person_type": "staff",
             "linked_person_id": staff_rows[i].staff_id,
             "is_active": True, "created_at": NOW - 30 * DAY},
            username=f"staff_demo{i + 1}")
    db.commit()
    return staff_rows


def seed_zones_equipment(db):
    zones = []
    for name, term, floor, cap in ZONES:
        z, _ = get_or_create(db, wayfinding.Zone,
                             {"terminal": term, "floor_level": floor,
                              "capacity": cap,
                              "current_occupancy": RNG.randint(20, 200)},
                             zone_name=name)
        zones.append(z)
    eq_types = (["checkin_kiosk"] * 4 + ["baggage_scanner"] * 4
                + ["security_gate"] * 8 + ["boarding_gate_display"] * 4
                + ["camera"] * 22 + ["solar_panel_array"] * 2
                + ["battery_bank"] * 1)
    equip = []
    for i, et in enumerate(eq_types):
        e, _ = get_or_create(
            db, devices.Equipment,
            {"equipment_type": et, "label": f"{et}-{i + 1:02d}",
             "model": f"MODEL-{et[:4].upper()}-2024",
             "zone_id": zones[i % len(zones)].zone_id,
             "install_date": (NOW - timedelta(days=200 + i)).date(),
             "firmware_version": f"v{(i % 3) + 1}.{(i % 7)}.0",
             "status": ("operational" if i % 9 else "degraded")
                       if i % 13 else "down",
             "last_health_check": NOW - timedelta(hours=i % 20 + 1)},
            serial_number=f"SN-DEMO-{et[:4].upper()}-{i + 1:03d}")
        equip.append(e)
        if i % 2 == 0:  # telemetry sample per device
            db.add(devices.EquipmentHealthCheck(
                equipment_id=e.equipment_id,
                check_time=NOW - timedelta(hours=i % 20 + 1),
                metric_type=RNG.choice(["cpu_temp", "network_latency",
                                        "uptime", "camera_feed_status"]),
                value=round(RNG.uniform(20, 90), 2),
                status_result=("ok" if e.status == "operational"
                               else "warning")))
    db.commit()
    return zones, equip


def seed_gates_cameras(db, zones, equip):
    scanners = [e for e in equip if e.equipment_type == "baggage_scanner"]
    sec_eq = [e for e in equip if e.equipment_type == "security_gate"]
    disp_eq = [e for e in equip if e.equipment_type == "boarding_gate_display"]
    cam_eq = [e for e in equip if e.equipment_type == "camera"]
    sec_gates = []
    for i, loc in enumerate(SECURITY_GATES):
        g, _ = get_or_create(
            db, security.SecurityGate,
            {"zone_id": zones[(i % 2) + 1].zone_id,
             "equipment_id": sec_eq[i].equipment_id if i < len(sec_eq) else None,
             "status": "maintenance" if i == 7 else "active"},
            location=loc)
        sec_gates.append(g)
    board_gates = []
    for i, num in enumerate(BOARDING_GATES):
        g, _ = get_or_create(
            db, security.BoardingGate,
            {"zone_id": zones[4 + (i % 2)].zone_id,
             "equipment_id": disp_eq[i].equipment_id if i < len(disp_eq) else None,
             "status": RNG.choice(["closed", "boarding",
                                   "final_call", "departed"])},
            gate_number=num)
        board_gates.append(g)
    cams = []
    for i in range(22):
        c, _ = get_or_create(
            db, admin_cameras.Camera,
            {"zone_id": zones[i % len(zones)].zone_id,
             "camera_type": RNG.choice(["identity", "security", "monitoring"]),
             "equipment_id": cam_eq[i].equipment_id if i < len(cam_eq) else None,
             "status": "offline" if i in (5, 17) else "online"},
            location=f"T2-CAM-{i + 1:02d}")
        cams.append(c)
    db.commit()
    return sec_gates, board_gates, cams, scanners


def seed_flights(db, board_gates):
    airlines = db.query(flights.Airline).all()
    airports = {a.iata_code: a for a in db.query(flights.Airport).all()}
    codes = list(airports)
    out = []
    for i, (num, status) in enumerate(zip(FLIGHT_NUMS, FLIGHT_STATUSES)):
        sched = (NOW - timedelta(days=6) + timedelta(hours=i * 7)).replace(
            minute=0, second=0, microsecond=0)
        actual = None
        if status == "departed":
            actual = sched + timedelta(minutes=RNG.randint(0, 25))
        f, _ = get_or_create(
            db, flights.Flight,
            {"airline_id": airlines[i % len(airlines)].airline_id,
             "origin_airport_id": airports["CAI"].airport_id,
             "destination_airport_id": airports[codes[(i + 3) % len(codes)]].airport_id,
             "scheduled_departure": sched,
             "actual_departure": actual,
             "boarding_gate_id": board_gates[i % len(board_gates)].boarding_gate_id,
             "status": status},
            flight_number=num)
        out.append(f)
    db.commit()
    return out


def seed_passenger_journeys(db, all_flights, sec_gates, board_gates,
                            equip, staff_rows, cams, scanners, zones):
    kiosks = [e for e in equip if e.equipment_type == "checkin_kiosk"]
    bookings, bags, inspections = [], [], []
    t0 = NOW - timedelta(days=6, hours=2)
    for i, (name, cc, dob, phone) in enumerate(PASSENGERS):
        email = slug_name(name, i)
        ts = t0 + timedelta(hours=i * 5)
        p, _ = get_or_create(
            db, identity.Passenger,
            {"full_name": name, "date_of_birth":
             datetime.strptime(dob, "%Y-%m-%d").date(),
             "nationality_country_code": cc, "phone": phone,
             "password_hash": AuthService.get_password_hash("Demo123!"),
             "biometric_consent": True, "consent_date": ts,
             "is_active": True, "created_at": ts, "updated_at": ts},
            email=email)
        doc_no = f"P{i + 1:07d}7"
        doc, _ = get_or_create(
            db, identity.TravelDocument,
            {"passenger_id": p.passenger_id, "document_type": "passport",
             "issuing_country_code": cc,
             "expiry_date": (NOW + timedelta(days=365 * 5)).date(),
             "mrz_hash": f"mrz-{doc_no.lower()}", "is_primary": True,
             "created_at": ts},
            document_number=doc_no)
        face, _ = get_or_create(
            db, identity.FaceEnrollment,
            {"document_id": doc.document_id,
             "equipment_id": kiosks[i % len(kiosks)].equipment_id,
             "face_embedding_ref": f"emb/{p.passenger_id}.npy",
             "embedding_model": "arcface-r100",
             "enrollment_time": ts + timedelta(minutes=10),
             "status": "active"},
            passenger_id=p.passenger_id)
        if i % 2 == 0:
            db.add(identity.PassengerDevice(
                passenger_id=p.passenger_id,
                device_type="android" if i % 4 == 0 else "ios",
                push_token=f"push-demo-token-{p.passenger_id:04d}",
                app_version="2.4.1",
                last_active=ts + timedelta(hours=2)))
        if i < 3:  # passenger-linked user accounts for first 3 passengers
            get_or_create(
                db, admin_cameras.UserAccount,
                {"email": email,
                 "password_hash": AuthService.get_password_hash("Demo123!"),
                 "linked_person_type": "passenger",
                 "linked_person_id": p.passenger_id,
                 "is_active": True, "created_at": ts},
                username=f"pax_demo{i + 1}")
        fl = all_flights[i % len(all_flights)]
        cancelled = fl.status == "cancelled"
        b, _ = get_or_create(
            db, flights.Booking,
            {"passenger_id": p.passenger_id, "flight_id": fl.flight_id,
             "seat_number": f"{(i % 40) + 1}{chr(65 + (i % 6))}",
             "booking_class": ["economy", "economy", "business", "first"][i % 4],
             "booking_status": ("cancelled" if cancelled
                                else ("boarded" if i % 3 == 0 else
                                      ("checked_in" if i % 3 == 1 else "confirmed"))),
             "created_at": ts},
            booking_reference=f"DEMO{i + 1:04d}")
        bookings.append(b)
        # flight-status notifications (delayed / cancelled)
        if fl.status == "delayed":
            db.add(flights.Notification(
                passenger_id=p.passenger_id, channel="push",
                notification_type="gate_change",
                content=f"Flight {fl.flight_number} delayed by 45 minutes.",
                related_entity_type="flight",
                related_entity_id=fl.flight_id,
                sent_at=ts + timedelta(hours=3)))
        if cancelled:
            db.add(flights.Notification(
                passenger_id=p.passenger_id, channel="sms",
                notification_type="gate_change",
                content=f"Flight {fl.flight_number} cancelled. Rebooking options available.",
                related_entity_type="flight",
                related_entity_id=fl.flight_id,
                sent_at=ts + timedelta(hours=3)))
            continue  # cancelled journey ends here (no check-in)
        ci, _ = get_or_create(
            db, check_in.CheckInRecord,
            {"passenger_id": p.passenger_id,
             "equipment_id": kiosks[i % len(kiosks)].equipment_id,
             "checkin_time": ts + timedelta(hours=4)},
            booking_id=b.booking_id)
        n_bags = [1, 1, 2, 2][i % 4]
        for k in range(n_bags):
            idx = len(bags)
            bag, _ = get_or_create(
                db, check_in.Bag,
                {"booking_id": b.booking_id, "passenger_id": p.passenger_id,
                 "checkin_id": ci.checkin_id,
                 "qr_code": f"QRDEMO{idx + 1:06d}",
                 "weight_kg": round(RNG.uniform(12, 30), 2),
                 "excess_charge": 0,
                 "current_status": RNG.choice(["moving", "stationary", "loaded"]),
                 "current_location": "Baggage Sorting Hall",
                 "created_at": ts + timedelta(hours=4, minutes=5)},
                rfid_tag=f"RFDEMO{idx + 1:05d}")
            bags.append(bag)
            for step, ctype in enumerate(
                    ["checkin", "security_scan", "conveyor", "loaded_on_aircraft"][:3]):
                db.add(check_in.BagCheckpointLog(
                    bag_id=bag.bag_id, checkpoint_type=ctype,
                    equipment_id=(scanners[idx % len(scanners)].equipment_id
                                  if scanners and ctype == "security_scan" else None),
                    location="Baggage Sorting Hall",
                    timestamp=ts + timedelta(hours=4, minutes=10 + step * 15)))
            suspicious = (i in (3, 11, 19))  # planted threat scenarios
            insp, _ = get_or_create(
                db, baggage_security_screening.BaggageInspection,
                {"equipment_id": (scanners[idx % len(scanners)].equipment_id
                                  if scanners else None),
                 "scan_time": ts + timedelta(hours=4, minutes=30),
                 "ai_model_version": "btd-yolo11",
                 "result": "MANUAL_REVIEW" if suspicious else "SAFE",
                 "reviewed_by_staff_id": (staff_rows[i % len(staff_rows)].staff_id
                                          if suspicious else None)},
                bag_id=bag.bag_id)
            inspections.append(insp)
            if suspicious:
                for it in RNG.sample(ITEM_TYPES, 2):
                    db.add(baggage_security_screening.DetectedItem(
                        inspection_id=insp.inspection_id, item_type=it,
                        confidence_score=round(RNG.uniform(78, 99), 2)))
                ev = admin_cameras.EmergencyEvent(
                    event_type="suspicious_bag",
                    zone_id=zones[7].zone_id,
                    notified_staff_id=staff_rows[i % len(staff_rows)].staff_id,
                    status="dispatched",
                    detected_time=ts + timedelta(hours=4, minutes=40))
                db.add(ev)
                db.flush()
                db.add(admin_cameras.MonitoringAlert(
                    camera_id=cams[i % len(cams)].camera_id,
                    zone_id=zones[7].zone_id,
                    behavior_type="unattended_bag", severity="high",
                    status="open", linked_emergency_event_id=ev.event_id,
                    timestamp=ts + timedelta(hours=4, minutes=42)))
            else:  # benign electronics on cleared bags (cleared, logged)
                db.add(baggage_security_screening.DetectedItem(
                    inspection_id=insp.inspection_id,
                    item_type=["laptop", "power_bank",
                               "battery"][idx % 3],
                    confidence_score=round(RNG.uniform(85, 98), 2)))
            # face verification + security gate + boarding chain
            sim = (0.42 if i == 7 else round(RNG.uniform(0.68, 0.97), 4))
            vstatus = ("verified" if sim >= 0.6 else "failed")
            ver = identity.FaceVerificationLog(
                passenger_id=p.passenger_id,
                enrollment_id=face.enrollment_id,
                equipment_id=sec_gates[i % len(sec_gates)].equipment_id,
                checkpoint_type="security_gate",
                cosine_similarity=sim, match_threshold=0.6,
                verification_status=vstatus,
                timestamp=ts + timedelta(hours=5))
            db.add(ver)
            db.flush()
            db.add(security.SecurityGateLog(
                passenger_id=p.passenger_id,
                gate_id=sec_gates[i % len(sec_gates)].gate_id,
                verification_id=ver.verification_id,
                authorization_result=("authorized" if vstatus == "verified"
                                      else "denied"),
                gate_opened=(vstatus == "verified"),
                timestamp=ts + timedelta(hours=5, minutes=2)))
            if vstatus == "verified" and fl.status in (
                    "boarding", "scheduled", "delayed", "departed"):
                ver2 = identity.FaceVerificationLog(
                    passenger_id=p.passenger_id,
                    enrollment_id=face.enrollment_id,
                    checkpoint_type="boarding_gate",
                    cosine_similarity=round(RNG.uniform(0.7, 0.96), 4),
                    match_threshold=0.6, verification_status="verified",
                    timestamp=ts + timedelta(hours=6))
                db.add(ver2)
                db.flush()
                db.add(security.BoardingLog(
                    passenger_id=p.passenger_id, flight_id=fl.flight_id,
                    boarding_gate_id=fl.boarding_gate_id,
                    verification_id=ver2.verification_id,
                    boarding_status="boarded",
                    timestamp=ts + timedelta(hours=6, minutes=2)))
                db.add(flights.Notification(
                    passenger_id=p.passenger_id, channel="push",
                    notification_type="boarding_call",
                    content=f"Boarding call: flight {fl.flight_number}.",
                    related_entity_type="flight",
                    related_entity_id=fl.flight_id,
                    sent_at=ts + timedelta(hours=5, minutes=50)))
            db.add(flights.Notification(
                passenger_id=p.passenger_id, channel="push",
                notification_type="bag_status",
                content=(f"Bag {bag.rfid_tag} loaded."
                         if n_bags else "Travel light: no checked bags."),
                related_entity_type="bag",
                related_entity_id=(bag.bag_id if n_bags else None),
                sent_at=ts + timedelta(hours=4, minutes=50)))
        db.flush()
    db.commit()
    return bookings, bags, inspections


# ------------------------------------------------------------- maintenance
TABLES_RESET_ORDER = [  # children first
    admin_cameras.AuditLog, admin_cameras.DigitalTwinPosition,
    sustainability.EnergyConsumptionLog, sustainability.EnergyGenerationLog,
    sustainability.EnergyStorage, sustainability.SolarInstallation,
    sustainability.PowerSource, wayfinding.MapEdge, wayfinding.MapNode,
    admin_cameras.MonitoringAlert, admin_cameras.EmergencyEvent,
    security.BoardingLog, security.SecurityGateLog,
    identity.FaceVerificationLog,
    baggage_security_screening.DetectedItem,
    baggage_security_screening.BaggageInspection,
    check_in.BagCheckpointLog, check_in.Bag, check_in.CheckInRecord,
    flights.Notification, flights.Booking, identity.FaceEnrollment,
    identity.PassengerDevice, identity.TravelDocument,
    admin_cameras.UserAccount, admin_cameras.Camera,
    security.BoardingGate, security.SecurityGate,
    devices.EquipmentHealthCheck, devices.Equipment,
    flights.Flight, wayfinding.Zone,
    staff.StaffRole, staff.RolePermission, staff.K9Unit, staff.Staff,
]


def _demo_id_sets(db):
    """Collect PK sets identifying seed-generated rows (exact markers)."""
    demo_pax = [r[0] for r in db.query(identity.Passenger.passenger_id)
                .filter(identity.Passenger.email.like(f"%{DEMO_EMAIL_DOMAIN}")).all()]
    demo_bookings = [r[0] for r in db.query(flights.Booking.booking_id)
                     .filter(flights.Booking.booking_reference.like("DEMO%")).all()]
    demo_bags = [r[0] for r in db.query(check_in.Bag.bag_id)
                 .filter(check_in.Bag.rfid_tag.like("RFDEMO%")).all()]
    demo_eq = [r[0] for r in db.query(devices.Equipment.equipment_id)
               .filter(devices.Equipment.serial_number.like("SN-DEMO-%")).all()]
    demo_cams = [r[0] for r in db.query(admin_cameras.Camera.camera_id)
                 .filter(admin_cameras.Camera.location.like("T2-CAM-%")).all()]
    demo_zones = [r[0] for r in db.query(wayfinding.Zone.zone_id)
                  .filter(wayfinding.Zone.zone_name.in_(
                      [z[0] for z in ZONES])).all()]
    demo_sec_gates = [r[0] for r in db.query(security.SecurityGate.gate_id)
                      .filter(security.SecurityGate.location.in_(SECURITY_GATES)).all()]
    demo_board_gates = [r[0] for r in db.query(security.BoardingGate.boarding_gate_id)
                        .filter(security.BoardingGate.gate_number.in_(BOARDING_GATES)).all()]
    demo_staff = [r[0] for r in db.query(staff.Staff.staff_id)
                  .filter(staff.Staff.full_name.like("Staff Member __")).all()]
    demo_insp = []
    if demo_bags:
        demo_insp = [r[0] for r in db.query(
            baggage_security_screening.BaggageInspection.inspection_id).filter(
                baggage_security_screening.BaggageInspection.bag_id.in_(demo_bags)).all()]
    demo_installs = []
    if demo_zones:
        demo_installs = [r[0] for r in db.query(
            sustainability.SolarInstallation.installation_id).filter(
                sustainability.SolarInstallation.zone_id.in_(demo_zones)).all()]
    return locals()


def reset_demo(db):
    """Delete ONLY demo seed rows (exact markers + demo-linked children).

    Strict children-first order -- the models declare ForeignKeys without
    database-level ON DELETE cascades, so parents must go last.
    Shared lookup tables (country/airline/airport/department/role/
    permission) are intentionally left untouched.
    """
    d = _demo_id_sets(db)

    def wipe(query):
        query.delete(synchronize_session=False)

    if True:  # leaf / log tables first
        wipe(db.query(admin_cameras.AuditLog).filter(
            admin_cameras.AuditLog.ip_address.like("10.0.0.%")))
        if d["demo_pax"] or d["demo_bags"]:
            conds = []
            if d["demo_pax"]:
                conds.append(admin_cameras.DigitalTwinPosition.entity_type
                             == "passenger")
            twin_q = db.query(admin_cameras.DigitalTwinPosition)
            if d["demo_pax"]:
                wipe(twin_q.filter(
                    admin_cameras.DigitalTwinPosition.entity_type == "passenger",
                    admin_cameras.DigitalTwinPosition.entity_id.in_(d["demo_pax"])))
            if d["demo_bags"]:
                wipe(db.query(admin_cameras.DigitalTwinPosition).filter(
                    admin_cameras.DigitalTwinPosition.entity_type == "bag",
                    admin_cameras.DigitalTwinPosition.entity_id.in_(d["demo_bags"])))
        if d["demo_zones"]:
            wipe(db.query(sustainability.EnergyConsumptionLog).filter(
                sustainability.EnergyConsumptionLog.zone_id.in_(d["demo_zones"])))
        if d["demo_installs"]:
            wipe(db.query(sustainability.EnergyGenerationLog).filter(
                sustainability.EnergyGenerationLog.installation_id.in_(d["demo_installs"])))
            wipe(db.query(sustainability.EnergyStorage).filter(
                sustainability.EnergyStorage.installation_id.in_(d["demo_installs"])))
            wipe(db.query(sustainability.SolarInstallation).filter(
                sustainability.SolarInstallation.installation_id.in_(d["demo_installs"])))
        wipe(db.query(sustainability.PowerSource).filter(
            sustainability.PowerSource.description.like("%feed T2")))
        if d["demo_zones"]:
            demo_nodes = [r[0] for r in db.query(wayfinding.MapNode.node_id)
                          .filter(wayfinding.MapNode.zone_id.in_(d["demo_zones"])).all()]
            if demo_nodes:
                from sqlalchemy import or_ as _or2
                wipe(db.query(wayfinding.MapEdge).filter(_or2(
                    wayfinding.MapEdge.from_node_id.in_(demo_nodes),
                    wayfinding.MapEdge.to_node_id.in_(demo_nodes))))
            wipe(db.query(wayfinding.MapNode).filter(
                wayfinding.MapNode.zone_id.in_(d["demo_zones"])))
        if d["demo_cams"] or d["demo_zones"]:
            filt = []
            if d["demo_cams"]:
                filt.append(admin_cameras.MonitoringAlert.camera_id.in_(d["demo_cams"]))
            if d["demo_zones"]:
                filt.append(admin_cameras.MonitoringAlert.zone_id.in_(d["demo_zones"]))
            from sqlalchemy import or_ as _or
            wipe(db.query(admin_cameras.MonitoringAlert).filter(_or(*filt)))
        # emergency events: only those no longer referenced by any alert
        # and sitting in a demo zone (seed-created), or linked from deleted demo alerts
        if d["demo_zones"]:
            linked = [r[0] for r in db.query(
                admin_cameras.MonitoringAlert.linked_emergency_event_id)
                .filter(admin_cameras.MonitoringAlert.linked_emergency_event_id.isnot(None))
                .distinct().all()]
            ev_q = db.query(admin_cameras.EmergencyEvent).filter(
                admin_cameras.EmergencyEvent.zone_id.in_(d["demo_zones"]))
            if linked:
                ev_q = ev_q.filter(~admin_cameras.EmergencyEvent.event_id.in_(linked))
            wipe(ev_q)
        if d["demo_pax"]:
            wipe(db.query(security.BoardingLog).filter(
                security.BoardingLog.passenger_id.in_(d["demo_pax"])))
            wipe(db.query(security.SecurityGateLog).filter(
                security.SecurityGateLog.passenger_id.in_(d["demo_pax"])))
            wipe(db.query(identity.FaceVerificationLog).filter(
                identity.FaceVerificationLog.passenger_id.in_(d["demo_pax"])))
        if d["demo_insp"]:
            wipe(db.query(baggage_security_screening.DetectedItem).filter(
                baggage_security_screening.DetectedItem.inspection_id.in_(d["demo_insp"])))
            wipe(db.query(baggage_security_screening.BaggageInspection).filter(
                baggage_security_screening.BaggageInspection.inspection_id.in_(d["demo_insp"])))
        if d["demo_bags"]:
            wipe(db.query(check_in.BagCheckpointLog).filter(
                check_in.BagCheckpointLog.bag_id.in_(d["demo_bags"])))
            wipe(db.query(check_in.Bag).filter(
                check_in.Bag.bag_id.in_(d["demo_bags"])))
        if d["demo_bookings"]:
            wipe(db.query(check_in.CheckInRecord).filter(
                check_in.CheckInRecord.booking_id.in_(d["demo_bookings"])))
        if d["demo_pax"]:
            wipe(db.query(flights.Notification).filter(
                flights.Notification.passenger_id.in_(d["demo_pax"])))
            wipe(db.query(identity.FaceEnrollment).filter(
                identity.FaceEnrollment.passenger_id.in_(d["demo_pax"])))
            wipe(db.query(identity.PassengerDevice).filter(
                identity.PassengerDevice.passenger_id.in_(d["demo_pax"])))
            wipe(db.query(identity.TravelDocument).filter(
                identity.TravelDocument.passenger_id.in_(d["demo_pax"])))
        if d["demo_cams"]:
            wipe(db.query(admin_cameras.Camera).filter(
                admin_cameras.Camera.camera_id.in_(d["demo_cams"])))
        # bookings reference flights, flights reference boarding gates:
        # bookings -> flights -> gates.
        if d["demo_bookings"]:
            wipe(db.query(flights.Booking).filter(
                flights.Booking.booking_id.in_(d["demo_bookings"])))
        wipe(db.query(flights.Flight).filter(
            flights.Flight.flight_number.in_(FLIGHT_NUMS)))
        if d["demo_board_gates"]:
            wipe(db.query(security.BoardingGate).filter(
                security.BoardingGate.boarding_gate_id.in_(d["demo_board_gates"])))
        if d["demo_sec_gates"]:
            wipe(db.query(security.SecurityGate).filter(
                security.SecurityGate.gate_id.in_(d["demo_sec_gates"])))
        if d["demo_eq"]:
            wipe(db.query(devices.EquipmentHealthCheck).filter(
                devices.EquipmentHealthCheck.equipment_id.in_(d["demo_eq"])))
        if d["demo_eq"]:
            wipe(db.query(devices.Equipment).filter(
                devices.Equipment.equipment_id.in_(d["demo_eq"])))
        wipe(db.query(admin_cameras.UserAccount).filter(
            admin_cameras.UserAccount.username.like("staff_demo%")))
        wipe(db.query(admin_cameras.UserAccount).filter(
            admin_cameras.UserAccount.username.like("pax_demo%")))
        if d["demo_staff"]:
            wipe(db.query(staff.StaffRole).filter(
                staff.StaffRole.staff_id.in_(d["demo_staff"])))
            wipe(db.query(staff.K9Unit).filter(
                staff.K9Unit.handler_staff_id.in_(d["demo_staff"])))
            wipe(db.query(staff.Staff).filter(
                staff.Staff.staff_id.in_(d["demo_staff"])))
        # role<->permission mappings for seed-managed roles only
        seed_role_ids = [r[0] for r in db.query(staff.Role.role_id)
                         .filter(staff.Role.role_name.in_(
                             [r[0] for r in ROLES])).all()]
        if seed_role_ids:
            wipe(db.query(staff.RolePermission).filter(
                staff.RolePermission.role_id.in_(seed_role_ids)))
        if d["demo_pax"]:
            wipe(db.query(identity.Passenger).filter(
                identity.Passenger.passenger_id.in_(d["demo_pax"])))
        if d["demo_zones"]:
            wipe(db.query(wayfinding.Zone).filter(
                wayfinding.Zone.zone_id.in_(d["demo_zones"])))
    db.commit()


def print_stats(db):
    print(f"{'table':32s} rows")
    print("-" * 42)
    total = 0
    for m in [identity.Country, identity.Passenger, identity.TravelDocument,
              identity.FaceEnrollment, identity.FaceVerificationLog,
              identity.PassengerDevice, flights.Airline, flights.Airport,
              flights.Flight, flights.Booking, flights.Notification,
              check_in.CheckInRecord, check_in.Bag, check_in.BagCheckpointLog,
              baggage_security_screening.BaggageInspection,
              baggage_security_screening.DetectedItem,
              security.SecurityGate, security.SecurityGateLog,
              security.BoardingGate, security.BoardingLog,
              wayfinding.Zone, wayfinding.MapNode, wayfinding.MapEdge,
              staff.Department, staff.Staff, staff.Role, staff.Permission,
              staff.RolePermission, staff.StaffRole, staff.K9Unit,
              admin_cameras.UserAccount, admin_cameras.Camera,
              admin_cameras.EmergencyEvent, admin_cameras.MonitoringAlert,
              admin_cameras.DigitalTwinPosition, admin_cameras.AuditLog,
              devices.Equipment, devices.EquipmentHealthCheck,
              sustainability.PowerSource, sustainability.SolarInstallation,
              sustainability.EnergyGenerationLog,
              sustainability.EnergyStorage,
              sustainability.EnergyConsumptionLog]:
        n = db.query(func.count("*")).select_from(m).scalar() or 0
        total += n
        print(f"{m.__tablename__:32s} {n}")
    print("-" * 42)
    print(f"{'TOTAL':32s} {total}")


def seed_all():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_reference(db)
        # Idempotency guard: log/fact tables below have no natural unique key,
        # so a completed seed is detected (not duplicated). An incomplete
        # seed (crash midway) is reset first, then seeded fresh.
        n_demo = db.query(func.count("*")).select_from(identity.Passenger).filter(
            identity.Passenger.email.like(f"%{DEMO_EMAIL_DOMAIN}")).scalar() or 0
        n_bags = db.query(func.count("*")).select_from(check_in.Bag).filter(
            check_in.Bag.rfid_tag.like("RFDEMO%")).scalar() or 0
        if n_demo >= len(PASSENGERS) and n_bags >= 30:
            print("Demo data already present -- nothing to do (use --reset to reseed).")
            print_stats(db)
            return
        if n_demo or n_bags:
            print("Incomplete previous seed detected -- resetting demo rows first.")
            reset_demo(db)
        staff_rows = seed_staff(db)
        zones, equip = seed_zones_equipment(db)
        sec_gates, board_gates, cams, scanners = seed_gates_cameras(
            db, zones, equip)
        all_flights = seed_flights(db, board_gates)
        seed_passenger_journeys(db, all_flights, sec_gates, board_gates,
                                equip, staff_rows, cams, scanners, zones)
        print("Seed complete (idempotent; re-runs create no duplicates).")
        print_stats(db)
    finally:
        db.close()


def main():
    ap = argparse.ArgumentParser(description="Seed smart_airport demo data")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--seed", action="store_true")
    args = ap.parse_args()
    if args.reset:
        db = SessionLocal()
        try:
            reset_demo(db)
            print("Demo seed rows removed.")
            print_stats(db)
        finally:
            db.close()
        return
    if args.stats:
        db = SessionLocal()
        try:
            print_stats(db)
        finally:
            db.close()
        return
    seed_all()


if __name__ == "__main__":
    main()
