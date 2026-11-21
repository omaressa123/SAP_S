# Smart Green Airport Ecosystem

**AI + IoT + Software + Cisco Network** platform for a fully instrumented smart airport.

<p align="center">
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Tech%20Stack-FastAPI%20%7C%20React%20%7C%20Python%20%7C%20PostgreSQL-blue.svg" alt="Tech Stack"></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-Multi--Agent%20System-green.svg" alt="Architecture"></a>
  <a href="#problem-solved"><img src="https://img.shields.io/badge/Problem%20Solved-Airport%20Automation-blueviolet.svg" alt="Problem Solved"></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"></a>
</p>

The passenger journey (Mobile App → Check-in → Security → Boarding → Flight Ops → Baggage) is the single central business process; AI, Software, Database, and Network are technical layers of one system.

## Repository Layout

```
air_ai/
├── backend/             # FastAPI REST API (core system API) + autonomous agent layer
├── frontend/            # React admin dashboard (Vite) + Agent Ops UI
├── Passenger_App/       # React Native + Expo mobile app
├── airport-twin/        # 3D digital twin (Babylon.js + FastAPI + WS)
├── AI/                  # Computer-vision services (YOLO, face recognition)
├── IOT/                 # ESP32 firmware modules (PlatformIO + MQTT)
├── docs/                # Architecture, UML, business model (drawio/MD)
├── schema.sql           # Database schema
└── Smart_Airport_App_Database-1.xlsx / .pptx / themes1.jpeg
```

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI (Python 3.14) | Core REST API, agent orchestration |
| **Frontend** | React 18 + Vite | Admin dashboard & operations UI |
| **Mobile** | Expo 57 / React Native | Passenger mobile app |
| **Digital Twin** | Babylon.js + FastAPI + WebSocket | 3D airport visualization |
| **AI Models** | YOLO11, DeepFace, MediaPipe RF | Baggage threat, face recognition, fall detection |
| **Database** | PostgreSQL + pgcrypto | Relational data storage |
| **CI/CD** | Docker Compose | Container orchestration |

## Problem Solved

Smart airports face fragmented operations across check-in, security, baggage, and flight management. This project solves:

| Problem | Solution |
|---|---|
| **Fragmented passenger journey** | Unified passenger-centric workflow from booking to baggage claim |
| **Manual baggage screening** | AI-powered X-ray threat detection (YOLO11) with MANUAL_REVIEW/SAFE decisions |
| **Security bottlenecks** | Biometric face verification at security and boarding gates |
| **Silos between systems** | Autonomous multi-agent orchestrator coordinating AI, backend, and twin |
| **No real-time visibility** | Digital Twin with live asset tracking and WebSocket updates |
| **No observability** | Agent registry, event system, workflow tracking, and decision audit trails |
| **No passenger mobile experience** | React Native app with boarding pass, baggage tracking, wayfinding, alerts |

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
        │ SQL                           │ HTTP
        ▼                               ▼
 ┌──────────────┐               ┌──────────────────────────┐
 │  Database    │               │  Edge hardware           │
 │  schema.sql  │               │  (standalone, external)  │
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
FastAPI backend, React dashboard, and the Digital Twin backend. No manual
terminals needed.

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

```bash
docker compose up -d        # detached
docker compose ps           # status
docker compose logs -f [service]
docker compose down         # stop — data kept (named volumes)
docker compose down -v      # DESTRUCTIVE: deletes the database
```

Notes:

- Startup order is health-gated: PostgreSQL (healthy) → schema init (`init_db.py`)
  → backend → frontend. The database survives
  `down`/`up` via the `postgres_data` volume.
- The frontend image bakes in `VITE_API_URL` (default `http://localhost:8000`,
  browser-accessible — never the Docker-internal `http://backend:8000`).
  `CORS_ORIGINS` defaults to `http://localhost` to match.
- If host ports are occupied, remap without touching container ports:
  `FRONTEND_HOST_PORT=3000 docker compose up -d`.
- Not containerized (run locally, see sections below): AI services (heavy
  TF/YOLO stacks — `AI/<module>`), and the
  Expo passenger app (`EXPO_PUBLIC_API_URL=http://<host-LAN-IP>:8000`).

## 1. Backend — `backend/`

FastAPI `Smart Airport System API` v2.0.0 (`backend/app/main.py`). Layered design: `controllers/` (HTTP routers, 14 domains) → `services/` → `repositories/` → `models/` (SQLAlchemy), plus `schemas/` (Pydantic), `core/`, `db/`, `config.py`.

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
| `/api/v1/maintenance` | Maintenance |
| `/api/v1/digital-twin` | Digital twin |
| `/api/v1/reports` | Reports & analytics |
| `/api/v1/ai` | AI Center |
| `/api/v1/agents` | Agent System (registry, tasks, workflows, events, health) |

Health: `GET /health`.

## 2. Frontend — `frontend/`

React 18 + Vite admin dashboard (`frontend/src/App.jsx`, `main.jsx`).

**Pages:**

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | System overview: KPIs, flight strip, zone occupancy, agent/twin health |
| Flights | `/flights` | Flight schedule & status |
| Passengers | `/passengers` | Passenger registry & verification |
| Baggage | `/baggage` | Baggage tracking & screening |
| Monitoring | `/monitoring` | CCTV & security monitoring |
| Digital Twin | `/digital-twin` | 3D twin position push |
| Reports | `/reports` | Analytics reports |
| AI Center | `/ai` | AI module registry |
| AI Monitor | `/ai-monitor` | AI service health, inference results, latency |
| Event Center | `/events` | Event log with filtering |
| Workflow Monitor | `/workflows` | Agent workflow states & decisions |

Shared `components/` (Navbar, Card, Table, Button), `hooks/` (useApi), `layouts/` (MainLayout), `services/` (API client), `routes/`.

## 3. Passenger Mobile App — `Passenger_App/`

Expo 57 / React Native client for travelers. 8 screens (`src/screens/`): Onboarding, Home, BoardingPass, Baggage, Wayfinding, Alerts, Green, Profile. Bottom-tab navigation (`src/navigation/RootNavigator.tsx`), global store (`src/store/AppStore.tsx`), services (`src/services/api.ts` REST + realtime + push, `storage.ts` cache/SecureStore), theme tokens from `themes1.jpeg` (navy `#071739` … sand `#E3C39D`). Mock-data fallback until the gateway is live; `EXPO_PUBLIC_API_URL` configures the API base. Details: `Passenger_App/workflow.md`.

## 4. Digital Twin — `airport-twin/`

Walkable 3D twin of the airport: Babylon.js web client (`apps/web-client`) + FastAPI/WebSocket twin backend (`backend/`, SQLite default, Postgres via `DATABASE_URL`). Real-time asset registry (`TERMINAL-001`… 26+ assets), flight state machine (SCHEDULED→BOARDING→PUSHBACK→TAXI→DEPARTED→AIRBORNE→ARRIVED), live FIDS, per-aircraft telemetry, 130 people, 4 aircraft, apron ops, teleport/debug cameras. Run:

```bash
cd airport-twin/backend && ../.venv/bin/python -m uvicorn main:app --port 8000
cd airport-twin/apps/web-client && npm run dev   # → http://localhost:5173
```

Twin REST API (port 8100): `GET /api/twin/assets`, `POST /api/twin/ingest`, `POST /api/twin/assets/{code}/command`, WebSocket `/ws/twin` (JWT auth).

## 5. AI Services — `AI/`

| Module | Purpose | Stack |
|---|---|---|
| `face_reco/` | Face enrollment & verification API (FastAPI) | DeepFace, OpenCV, SQLite |
| `smoke_fire_detection/` | Smoke/fire detection training pipeline | YOLO26n, YOLOv8s-cls |
| `fulldetection/` | Person/object full-scene detection web app | YOLO, FastAPI (`web_app.py`) |
| `Baggage_And_Person_Detector/` | Combined baggage + person detector (`Detector.py`) | YOLO/ONNX |
| `BTD/` | Baggage threat detection (best.pt/best.onnx, classes.json) | YOLO, ONNX |

## 7. Database — `schema.sql`

Relational schema covering the whole journey: passenger, travel_document, face_enrollment, face_verification_log, booking, checkin_record, bag, bag_checkpoint_log, baggage_inspection, detected_item, security_gate(_log), boarding_gate, boarding_log, flight, zone, equipment, camera, emergency_event, monitoring_alert, notification, user_account, staff, digital_twin_position.

## 8. Docs — `docs/`

`SMART_AIRPORT_Foundation.md` (business→software→network chain), drawio models: business model, UML use cases, activity diagrams, sequence diagrams.

## Database Design — `schema.sql`

PostgreSQL relational schema (498 SQL lines, ~29 tables) modeling the single central business process — the passenger journey — plus staff, security, and sustainability layers. Initialized automatically on container startup via `init_db.py` (health-gated after PostgreSQL becomes healthy).

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

## Agent Pipeline

Implemented autonomous multi-agent system (`backend/app/agents/`) that integrates existing AI models, backend, central database, and Digital Twin. No models are retrained or replaced — existing services are wrapped in typed adapters and orchestrated deterministically.

### Architecture

```
Perception (AI/IoT events) → Agent Registry → Orchestrator → Agent Actions
                                      ↓                              ↓
                               Event System ←── Decision Audit ←── Digital Twin
```

### Components

| Component | Location | Purpose |
|---|---|---|
| Agent Interface | `app/agents/base.py` | Common contract: capabilities, input validation, event handling, structured output, timeout, error handling |
| Agent Registry | `app/agents/registry.py` | Registers agents, tracks capabilities/health, prevents duplicate registration |
| Event System | `app/agents/events.py` | Event creation, validation, routing, correlation IDs, idempotency, PostgreSQL persistence |
| Orchestrator | `app/agents/orchestrator.py` | Deterministic event classification, routing, multi-step workflows, retry/timeout/duplicate protection |
| Model Adapters | `app/agents/adapters/` | Wrap existing AI services (face, baggage threat, safety) without retraining |
| Identity Agent | `app/agents/identity_agent.py` | Passport/MRZ validation + face verification → Verified / Retry / Review |
| Baggage Agent | `app/agents/baggage_agent.py` | Baggage tracking + real YOLO11 X-ray screening → SAFE / MANUAL_REVIEW / PROCESSING_ERROR |
| Safety Agent | `app/agents/safety_agent.py` | Fire/smoke/fall/restricted-area detection → severity-classified incidents |
| Twin Publisher | `app/agents/twin_publisher.py` | Publishes state changes to Digital Twin (`:8100` REST API) |
| Agent Service | `app/agents/service.py` | Wires registry, orchestrator, agents, and twin publisher together |

### BTD Inference Endpoint (`AI/BTD/inference_server.py`)

A lightweight FastAPI wrapper exposes the **existing** YOLO11 model (`AI/BTD/best.pt`) over HTTP without retraining or duplicating it. It imports the model instance already loaded by `AI/BTD/app.py`, so the weights load once per process. The existing Gradio UI (`app.py`) is unchanged and keeps working.

Endpoints:

- `GET /health` — model availability + class labels
- `POST /analyze` — upload an X-ray image (`image` field), optional `conf` / `iou`; returns real detections `{item_type, confidence, box}`

Startup (from `AI/BTD/`, requires `torch` + `ultralytics`):

```bash
python -m uvicorn inference_server:app --host 0.0.0.0 --port 8002
```

The backend references it via `BTD_INFERENCE_URL` (default `http://localhost:8002`).

### Model classes discovered

The YOLO11 checkpoint (`classes.json`) defines 12 threat/contraband classes:

`baton, bullet, gun, hammer, handcuffs, knife, lighter, pliers, powerbank, scissors, sprayer, wrench`

### Agents Implemented

1. **Identity Agent** (`identity_agent`) — Coordinates passport document validation and face verification via the existing `AI/face_reco` service. Applies explicit decision rules (document validity, face match, biometric consent, enrollment). Returns `verified` / `retry` / `review`. Never treats face recognition as proof of visa validity.

2. **Baggage Agent** (`baggage_agent`) — Tracks baggage identifiers/status via `bag`/`bag_checkpoint_log`. Accepts either an X-ray `image_path` (sent to the BTD inference endpoint for real YOLO11 inference) or precomputed detections. Applies explicit screening rules:

   - any detection → `MANUAL_REVIEW` (candidate threat, human review)
   - no detections → `SAFE`
   - inference/service failure → `PROCESSING_ERROR` (never silently `SAFE`)

   Records `baggage_inspection` + `detected_item`, holds suspicious bags, creates `emergency_event`/`monitoring_alert`, and publishes state changes to the Digital Twin.

3. **Safety Agent** (`safety_agent`) — Receives fire/smoke/fall/restricted-area/unattended-bag/overcrowding events. Classifies severity via explicit rules. Creates `emergency_event` and `monitoring_alert` records. All model detections are treated as candidates requiring human review.

### API Endpoints (`/api/v1/agents/`, X-API-KEY protected)

| Endpoint | Method | Purpose |
|---|---|---|
| `/registry` | GET | Registered agents + capabilities + health |
| `/agents/{id}` | GET | Single agent detail |
| `/tasks/{id}` | GET | Agent task status |
| `/workflows/{id}` | GET | Workflow execution status |
| `/workflows` | GET | List recent workflows |
| `/events` | GET | Recent airport events (filterable: event_type, severity, status, source) |
| `/events` | POST | Ingest and route a new airport event |
| `/agents/{id}/heartbeat` | POST | Agent heartbeat |
| `/snapshot` | GET | Full observability snapshot |
| `/agents/health` | GET | Agent service + Digital Twin connectivity health |

### Database Tables Added

`agentdefinition`, `agenttask`, `agenteexecution`, `airportevent`, `workflowexecution`, `decisionaudit` — created via `init_db.py` alongside existing tables. No existing tables are modified.

### Safety Boundaries

- Agents never execute arbitrary shell commands, unrestricted SQL, or unapproved physical actions.
- Model detections are candidate events, not confirmed emergencies — all require human review.
- Identity/immigration/security decisions route to human review when confidence is below threshold.
- Digital Twin is visualization-only; never the source of operational decisions.
- No Kafka, Redis, or new infrastructure — existing PostgreSQL + FastAPI is the message bus.

## Business Workflow

The passenger journey is the ONE central business process. AI, Software, Database, and Network are technical layers of that single system.

Canonical business chain (per `docs/SMART_AIRPORT_Foundation.md`):

```
BUSINESS MODEL → BUSINESS DIAGRAM → BUSINESS WORKFLOW → SYSTEM REQUIREMENTS
→ SOFTWARE ARCHITECTURE → SOFTWARE DIAGRAMS → NETWORK ARCHITECTURE
```

Actors: `Passenger, CheckInStaff, SecurityOfficer, GateStaff, BaggageStaff, GroundStaff, AirportAdmin, ITAdmin, MaintenanceTeam, EmergencyTeam, Airline, BorderControl, AISystem`

Systems: `MobileApp, SmartKiosk, SmartGate, BaggageSystem, SecuritySystem, Backend, AIPlatform, Database, DigitalTwinService, NotificationService, AdminDashboard, CiscoNetwork`

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
# AI services: cd AI/<module> && pip install -r requirements.txt
```

## Contributing

- Do not retrain or replace existing AI models; wrap them via adapters.
- Do not create placeholder implementations that appear production-ready.
- Do not hardcode credentials or environment-specific URLs; use `.env`.
- All agent-facing endpoints are protected by `X-API-KEY` authentication.
- Digital Twin integration is read-only for visualization; agents never control real equipment.