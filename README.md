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
