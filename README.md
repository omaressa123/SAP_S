# Smart Green Airport Ecosystem

AI + IoT + Software + Cisco Network platform for a fully instrumented smart airport. The passenger journey (Mobile App → Check-in → Security → Boarding → Flight Ops → Baggage) is the single central business process; AI, IoT, Software, Database, and Network are technical layers of one system.

## Repository Layout

```
air_ai/
├── backend/             # FastAPI REST API (core system API)
├── frontend/            # React admin dashboard (Vite)
├── Passenger_App/       # React Native + Expo mobile app
├── airport-twin/        # 3D digital twin (Babylon.js + FastAPI + WS)
├── AI/                  # Computer-vision services (YOLO, face recognition)
├── IOT/                 # ESP32 firmware modules (PlatformIO + MQTT)
├── docs/                # Architecture, UML, business model (drawio/MD)
├── schema.sql           # Database schema
└── Smart_Airport_App_Database-1.xlsx / .pptx / themes1.jpeg
```

## System Architecture

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
 │ Passenger_App│   │  frontend/   │   │  airport-twin/   │
 │ (Expo RN)    │   │ (React/Vite) │   │  (Babylon.js 3D) │
 └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
        │ REST             │ REST               │ REST + WS
        ▼                  ▼                    ▼
 ┌─────────────────────────────────────────────────────────┐
 │                    backend/ (FastAPI v2.0)              │
 │  controllers/ → services/ → repositories/ → models/     │
 └──────┬───────────────────────────────┬──────────────────┘
        │ SQL                           │ MQTT / HTTP
        ▼                               ▼
 ┌──────────────┐               ┌──────────────────────────┐
 │  Database    │               │  IOT/ ESP32 modules      │
 │  schema.sql  │               │  (11 modules, MQTT pub/  │
 └──────────────┘               │   sub over Mosquitto)    │
                                └──────────┬───────────────┘
                                           │ camera streams
                                           ▼
                                ┌──────────────────────────┐
                                │  AI/ vision services     │
                                │  (YOLO detect, smoke/    │
                                │   fire, face reco, bag)  │
                                └──────────────────────────┘
```

## Run with Docker (recommended)

The entire development environment starts with a single command — PostgreSQL,
Mosquitto, FastAPI backend, MQTT consumer, React dashboard, and the Digital
Twin backend. No manual terminals needed.

```bash
cp .env.example .env   # change ALL secrets before any deployment; .env is gitignored
docker compose up --build
```

| Service | Container | URL / Port |
|---|---|---|
| Dashboard (React + nginx) | `smart-airport-frontend` | http://localhost |
| Core API (FastAPI) | `smart-airport-backend` | http://localhost:8000 |
| API health | — | http://localhost:8000/health |
| Digital Twin API | `smart-airport-twin` | http://localhost:8100 |
| PostgreSQL 18 | `smart-airport-postgres` | `postgres:5432` (Docker) / `localhost:5432` (host tools) |
| Mosquitto MQTT | `smart-airport-mosquitto` | `mosquitto:1883` (Docker) / host LAN IP `:1883` (ESP32) |
| MQTT consumer | `smart-airport-mqtt-consumer` | `airport/#` → PostgreSQL |

```bash
docker compose up -d        # detached
docker compose ps           # status
docker compose logs -f [service]
docker compose down         # stop — data kept (named volumes)
docker compose down -v      # DESTRUCTIVE: deletes the database
```

Notes:

- Startup order is health-gated: PostgreSQL (healthy) → schema init (`init_db.py`)
  → Mosquitto → backend → MQTT consumer → frontend. The database survives
  `down`/`up` via the `postgres_data` volume.
- The frontend image bakes in `VITE_API_URL` (default `http://localhost:8000`,
  browser-accessible — never the Docker-internal `http://backend:8000`).
  `CORS_ORIGINS` defaults to `http://localhost` to match.
- If host ports are occupied, remap without touching container ports:
  `MQTT_HOST_PORT=1884 FRONTEND_HOST_PORT=3000 docker compose up -d`.
- ESP32 devices on the LAN must target this machine's **LAN IP** on port 1883
  (not `localhost`, not the `mosquitto` hostname).
- Verify the pipeline: publish `airport/fire-smoke/FIRE-001/event`, then check
  `equipment` + `emergency_event` + `monitoring_alert` rows and
  `/api/v1/reports/operations`.
- Not containerized (run locally, see sections below): AI services (heavy
  TF/YOLO stacks — `AI/<module>`), ESP32 firmware (`IOT/`, PlatformIO), and the
  Expo passenger app (`EXPO_PUBLIC_API_URL=http://<host-LAN-IP>:8000`).

## 1. Backend — `backend/`

FastAPI `Smart Airport System API` v2.0.0 (`backend/app/main.py`). Layered design: `controllers/` (HTTP routers, 13 domains) → `services/` → `repositories/` → `models/` (SQLAlchemy), plus `schemas/` (Pydantic), `core/`, `db/`, `config.py`.

Routers (`backend/app/controllers/`):

| Prefix | Domain |
|---|---|
| `/api/v1/auth` | Auth & user management |
| `/api/v1/passenger` | Passenger mobile app |
| `/api/v1/flights` | Flight operations |
| `/api/v1/kiosk` | Kiosk & passport smart login |
| `/api/v1/baggage-drop` | Smart check-in & baggage drop |
| `/api/v1/inspection` | AI baggage inspection |
| `/api/v1/baggage-tracking` | Baggage tracking |
| `/api/v1/security-gate` | Biometric security gate |
| `/api/v1/boarding-gate` | Biometric boarding gate |
| `/api/v1/monitoring` | CCTV monitoring |
| `/api/v1/k9-patrols` | K9 units |
| `/api/v1/maintenance` | IoT maintenance |
| `/api/v1/digital-twin` | Digital twin |

Health: `GET /health`.

## 2. Frontend — `frontend/`

React 18 + Vite admin dashboard (`frontend/src/App.jsx`, `main.jsx`). Pages: `Dashboard`, `Flights`, `Passengers`, `Baggage`, `Monitoring`, `DigitalTwin`. Shared `components/` (Navbar, Card, Table, Button), `hooks/`, `layouts/`, `services/` (API client), `routes/`.

## 3. Passenger Mobile App — `Passenger_App/`

Expo 57 / React Native client for travelers. 8 screens (`src/screens/`): Onboarding, Home, BoardingPass, Baggage, Wayfinding, Alerts, Green, Profile. Bottom-tab navigation (`src/navigation/RootNavigator.tsx`), global store (`src/store/AppStore.tsx`), services (`src/services/api.ts` REST + realtime + push, `storage.ts` cache/SecureStore), theme tokens from `themes1.jpeg` (navy `#071739` … sand `#E3C39D`). Mock-data fallback until the gateway is live; `EXPO_PUBLIC_API_URL` configures the API base. Details: `Passenger_App/workflow.md`.

## 4. Digital Twin — `airport-twin/`

Walkable 3D twin of the airport: Babylon.js web client (`apps/web-client`) + FastAPI/WebSocket twin backend (`backend/`, SQLite default, Postgres via `DATABASE_URL`). Real-time asset registry (`TERMINAL-001`… 26+ assets), flight state machine (SCHEDULED→BOARDING→PUSHBACK→TAXI→DEPARTED→AIRBORNE→ARRIVED), live FIDS, per-aircraft telemetry, 130 people, 4 aircraft, apron ops, teleport/debug cameras. Run:

```bash
cd airport-twin/backend && ../.venv/bin/python -m uvicorn main:app --port 8000
cd airport-twin/apps/web-client && npm run dev   # → http://localhost:5173
```

## 5. AI Services — `AI/`

| Module | Purpose | Stack |
|---|---|---|
| `face_reco/` | Face enrollment & verification API (FastAPI) | DeepFace, OpenCV, SQLite |
| `smoke_fire_detection/` | Smoke/fire detection training & inference | YOLO26n, YOLOv8s-cls |
| `fulldetection/` | Person/object full-scene detection web app | YOLO, FastAPI (`web_app.py`) |
| `Baggage_And_Person_Detector/` | Combined baggage + person detector (`Detector.py`) | YOLO/ONNX |
| `BTD/` | Baggage threat detection (best.pt/best.onnx, classes.json) | YOLO, ONNX |

## 6. IoT Firmware — `IOT/`

ESP32 firmware built with PlatformIO, simulated in Wokwi, telemetried over MQTT (Mosquitto, topic root `airport/{module}/{device_id}/{event}`). 11 modules under `IOT/modules/`:

`smart-airport-gate` (GATE-001), `passenger-counter` (COUNTER-001), `aircraft-parking` (AIRCRAFT-PARK-001), `smart-charging` (CHARGER-001), `equipment-monitoring` (EQUIPMENT-001), `security-area` (SECURITY-001), `smart-baggage` (BAGGAGE-001), `emergency-detection` (EMERG-001), `fire-smoke` (FIRE-001), `environment` (ENV-001), `smart-elevator` (ELEV-001). Shared headers in `IOT/common/`; docs in `IOT/docs/` (architecture, MQTT topic dictionary, device spec, integration guide). Build: `cd IOT/modules/<module> && pio run`.

## 7. Database — `schema.sql`

Relational schema covering the whole journey: passenger, travel_document, face_enrollment, face_verification_log, booking, checkin_record, bag, bag_checkpoint_log, baggage_inspection, detected_item, security_gate(_log), boarding_gate, boarding_log, flight, zone, equipment, camera, emergency_event, monitoring_alert, notification, user_account, staff, digital_twin_position.

## 8. Docs — `docs/`

`SMART_AIRPORT_Foundation.md` (business→software→network chain), drawio models: business model, UML use cases, activity diagrams, sequence diagrams.

## Database Design — `schema.sql`

PostgreSQL relational schema (498 SQL lines, ~29 tables) modeling the single central business process — the passenger journey — plus staff, IoT devices, security, and sustainability layers. Initialized automatically on container startup via `init_db.py` (health-gated after PostgreSQL becomes healthy).

Design principles:
- **Surrogate PKs** (`GENERATED BY DEFAULT AS IDENTITY` / `BIGINT`) on every entity; natural keys where unique (rfid_tag, qr_code, booking_reference, document_number, serial_number, iata_code).
- **`updated_at` auto-trigger** (`set_updated_at()` plpgsql function + per-table `BEFORE UPDATE` trigger) on mutable entities (equipment, passenger, checkin_record, bag).
- **Soft-delete-friendly** (`is_active` flags on passenger, staff, user_account; `status` enums elsewhere) rather than hard deletes.
- **Referential integrity** with `ON DELETE CASCADE`/`SET NULL`/`RESTRICT` chosen per relationship; composite PKs on junction tables (`role_permission`, `staff_role`).
- **pgcrypto extension** enabled for future `gen_random_uuid()` use.

### Schema design — domain breakdown

| Domain | Core tables | Purpose |
|---|---|---|
| Reference | `country` | ISO country lookup (nationality, document issuing country) |
| Staff & permissions | `department`, `staff`, `role`, `permission`, `role_permission`, `staff_role`, `k9_unit` | RBAC: staff → roles → permissions; K9 patrol units |
| Wayfinding | `zone`, `map_node`, `map_edge` | Zoned airport map graph (nodes/edges with distance, walk time, accessibility) |
| Devices & equipment | `equipment`, `equipment_health_check` | IoT/kiosk/gate/camera hardware registry + health metrics |
| Identity & face | `passenger`, `travel_document`, `face_enrollment`, `face_verification_log`, `passenger_device` | Traveler identity, biometric consent, face embedding refs, verification per checkpoint |
| Gates | `security_gate`, `boarding_gate` | Security & boarding gate state |
| Flights & bookings | `airline`, `airport`, `flight`, `booking`, `notification` | Flight schedule, bookings, passenger notifications |
| Check-in & baggage | `checkin_record`, `bag`, `bag_checkpoint_log` | Check-in, RFID/QR bag tagging, per-checkpoint bag location |
| Baggage security | `baggage_inspection`, `detected_item` | AI baggage scan results + flagged threat items |
| Security & boarding logs | `security_gate_log`, `boarding_log` | Gate authorization + boarding event audit |
| Admin, cameras & twin | `user_account`, `camera`, `emergency_event`, `monitoring_alert`, `digital_twin_position`, `audit_log` | Auth, CCTV, emergencies, digital twin positions, audit trail |
| Sustainability & power | `power_source`, `solar_installation`, `energy_generation_log`, `energy_storage`, `energy_consumption_log` | Solar/battery generation & consumption telemetry |

Key relationships (highlights):
- `passenger` 1:N `travel_document`, `face_enrollment`, `face_verification_log`, `bag`, `booking`, `notification`
- `booking` 1:1 `checkin_record`; `booking` 1:N `bag`
- `bag` 1:N `bag_checkpoint_log`; `bag` 1:N `baggage_inspection` 1:N `detected_item`
- `flight` 1:N `boarding_log`; `boarding_log` → `boarding_gate`, `face_verification_log`
- `equipment` 1:N `equipment_health_check`; `equipment` 1:1 `security_gate`/`boarding_gate`/`camera`/`solar_installation`

## Business Workflow

The passenger journey is the ONE central business process. AI, IoT, Software, Database, and Network are technical layers of that single system.

Canonical business chain (per `docs/SMART_AIRPORT_Foundation.md`):
```
BUSINESS MODEL → BUSINESS DIAGRAM → BUSINESS WORKFLOW → SYSTEM REQUIREMENTS
→ SOFTWARE ARCHITECTURE → SOFTWARE DIAGRAMS → NETWORK ARCHITECTURE
```

Actors: `Passenger, CheckInStaff, SecurityOfficer, GateStaff, BaggageStaff, GroundStaff, AirportAdmin, ITAdmin, MaintenanceTeam, EmergencyTeam, Airline, BorderControl, AISystem, IoTSystem`

Systems: `MobileApp, SmartKiosk, SmartGate, BaggageSystem, SecuritySystem, Backend, AIPlatform, IoTPlatform, Database, DigitalTwinService, NotificationService, AdminDashboard, CiscoNetwork`

End-to-end business workflow (passenger journey):
1. **Book & enroll** — Passenger books a flight; creates profile with travel document + optional biometric consent (face enrollment).
2. **Check-in** — Via Mobile App or Smart Kiosk → `checkin_record`; bags tagged with RFID/QR → `bag`.
3. **Bag drop & screening** — Bag moves through checkpoints (`bag_checkpoint_log`); AI scans at `baggage_inspection` flag `detected_item` → SAFE or MANUAL_REVIEW.
4. **Security gate** — Face verification at `security_gate` → `security_gate_log` authorized/denied.
5. **Boarding** — Face verification at `boarding_gate` → `boarding_log` boarded/rejected; flight state advances (SCHEDULED → BOARDING → DEPARTED → … → ARRIVED).
6. **Flight ops & baggage** — Ground/baggage staff load bags; digital twin tracks passenger & bag positions in real time.
7. **Monitoring & emergencies** — CCTV/AI produce `monitoring_alert` → `emergency_event` → staff dispatch/resolve; notifications pushed to passengers/staff.
8. **Sustainability** — Solar/battery energy generation & consumption logged per zone/equipment.

## User Flow

### Passenger (Mobile App)
```
Onboarding → Home (flight/bag status) → Boarding Pass → Baggage tracking
→ Wayfinding (map_node/map_edge path) → Alerts (push) → Green/sustainability
→ Profile
```
Key moments: book → check-in (kiosk/app) → bag drop → security face-scan → boarding face-scan → in-flight → baggage claim. Push notifications (`notification.channel = push`) for gate changes, bag status, boarding calls.

### Staff (Admin Dashboard + kiosks/gates)
- **Check-in staff:** verify documents, process check-in, issue bag tags.
- **Security officer:** review face-verification flags, authorize/deny gate, handle MANUAL_REVIEW bag inspections.
- **Gate staff:** manage boarding (boarded/rejected/duplicate_attempt), gate status (closed/boarding/final_call/departed).
- **Baggage/ground staff:** track bag checkpoints, load aircraft, update bag status.
- **Airport/IT admin:** manage users, roles/permissions, equipment health, emergency events, audit log.
- **Maintenance team:** respond to `equipment_health_check` warnings/criticals, update `equipment.status`.
- **Emergency team:** acknowledge/dispatch/resolve `emergency_event`.

## Agent Pipeline (Future)

Planned AI agent layer orchestrating the technical layers (AI, IoT, Software, Database, Network) around the passenger journey.

```
Perception (sensors/AI) → Orchestration (agent planner) → Action (actuators/APIs)
       ↑                                                        │
       └─────────────── Feedback (twin position, alerts) ───────┘
```

Proposed future stages:
1. **Perception agents** — consume `camera` streams (AI Platform: YOLO face/object/smoke-fire detection), IoT MQTT telemetry (`airport/{module}/{device}/{event}`), equipment health checks.
2. **Reasoning / planner agent** — correlates events across domains (e.g., unattended bag + crowding → emergency_event), decides staff dispatch, gate changes, or passenger re-routing.
3. **Action agents** — write to `emergency_event`, `monitoring_alert`, `notification`; command IoT actuators (gates, elevators, charging); update Digital Twin `digital_twin_position`.
4. **Memory & audit** — all agent decisions logged to `audit_log` (view/create/update/delete/export) for traceability and human-in-the-loop override.
5. **Human-in-the-loop** — high-confidence actions auto-execute; low-confidence / `flagged_for_staff` cases routed to `SecurityOfficer` / `EmergencyTeam` via Admin Dashboard.

The pipeline targets: reduced check-in/security/boarding latency, real-time baggage traceability, predictive equipment maintenance, and energy-aware operations.

## Quick Start (without Docker)

Prefer `docker compose up --build` above. Manual alternative:

```bash
# Core API
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# Admin dashboard
cd frontend && npm install && npm run dev

# Mobile app
cd Passenger_App && npm install && npx expo start

# Digital twin (see airport-twin/README.md)
# IoT firmware (see IOT/README.md)
# AI services: cd AI/<module> && pip install -r requirements.txt
```
