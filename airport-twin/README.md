# Smart Airport Digital Twin ✈

Walkable 3D airport (Babylon.js) + real-time twin backend (FastAPI + WebSocket + SQLite/Postgres).

## Run

Backend: `cd backend && ../.venv/bin/python -m uvicorn main:app --port 8000`
Client:  `cd apps/web-client && npm run dev` (proxy to :8000) → http://localhost:5173
Postgres: set `DATABASE_URL=postgresql+psycopg://...` (default: SQLite `backend/twin.db`).
Prod: `cd apps/web-client && npm run build` → `dist/` (5 MB, no external model downloads needed).

## What you get

- **Terminal A**: landside road/canopy/drop-off, 3 sliding-door entrances, departure hall,
  2 check-in islands + kiosks + queues, 2 security lanes (X-ray + arches), airside gates
  A01–A03 with seating + podiums, FIDS boards, baggage claim (2 carousels), shops/café,
  escalator, elevator, CCTV, signage everywhere.
- **Aircraft fleet (4)**: A001 stand A12 (walkable cabin) + A002 stand B14 (Nile Wings)
  + A003 stand C16 (Gulf Falcon) + A004 airborne departure looping the field.
  Each with own livery/reg, nav lights + beacons, spinning fans, twin telemetry.
- **People (130)**: articulated humanoids with faces (eyes/nose/mouth), stature
  variation incl. children, backpacks, rolling luggage, phones, uniforms —
  queues, seated, roaming, ramp crews on all 3 stands.
- **Real system**: flight-phase state machine (SCHEDULED→BOARDING→PUSHBACK→
  TAXI→DEPARTED→AIRBORNE→ARRIVED), live FIDS board (`/api/twin/flights`,
  `/api/twin/fids`, WS `fids_updated`), per-aircraft fuel/pax telemetry,
  30+ twin assets across stands A12/B14/C16.
- **Apron ops**: stand A12 markings, jet bridge, GPU, baggage cart train, pushback tug,
  shuttle bus, catering truck, fuel van, cones, service road.
- **Twin**: 26 assets (`TERMINAL-001 … AIRCRAFT-001 … CAM-021 …`), click → details panel
  (flight/fuel/bags/FPS), status beacons (operational/warning/maintenance/critical/offline),
  WebSocket live updates + telemetry ticks, simulation engine, event history, search,
  minimap, 14 teleport places, FP/TP/free/overview + 7 aircraft inspection cameras, debug mode.

## Acceptance (verified with headless-Chromium screenshots)

- [x] Airport + terminal + aircraft immediately recognizable (exterior/top/cabin shots)
- [x] People, vehicles, signs, entrances, apron, baggage hall visible
- [x] FP/TP/free/overview + front/rear/left/right/top/underbody/cabin cameras
- [x] Collision walk, sliding doors, jet-bridge ramp into cabin + cockpit
- [x] Asset IDs, click-to-inspect, status beacons, WS updates, sim failures, history
- [x] No placeholder-box aircraft/people/terminal; `tsc` + `vite build` clean
