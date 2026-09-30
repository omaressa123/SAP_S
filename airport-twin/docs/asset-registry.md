# Asset Registry
Every object has a stable `asset_id` (e.g. `CONV-001`). The mesh is not the asset: swapping the GLB never changes the ID.
Types: building, gate, conveyor, robot, camera, sensor, aircraft, room, equipment, display, furniture, passenger_group, vehicle.
Status (from backend only): operational, offline, maintenance, warning, critical, unknown.
Source: `apps/web-client/public/assets/registry.json` (seeds `twin_assets` on first backend start).

## GLB loading pipeline (Step 2)

`model_path` conventions, resolved by `resolveModelUrl()` in
`apps/web-client/src/engine/modelLoader.ts`:

| Prefix | Meaning |
|---|---|
| `procedural:<key>` | No remote file — primitive fallback builder only. |
| `glb:<file.glb>` | Vendored file at `public/assets/models/<file.glb>` (served as `/assets/models/…`). |
| `/…` or `http(s)://…` | Used as-is (absolute / remote). |
| `<file.glb>` | Treated as vendored `/assets/models/<file.glb>`. |

Loading via `SceneLoader.ImportMeshAsync` (`loadModelAsync()`):
- A DOM progress bar (`#glb-loading`) tracks the 7 template loads.
- Every load registers casters into the sun `ShadowGenerator` (except emissive
  screens/LEDs) and stamps `asset_id` into mesh metadata, so click-to-select,
  highlight and beacons keep working on GLB meshes.
- **Fallback rule:** the primitive fallback is disposed only after its GLB
  loads successfully. A missing/corrupt file logs a warning and the primitive
  stays — the scene can never blank.
- `upgradeToRealModels()` in `engine/realModels.ts` runs all swaps inside the
  stable asset_id anchors; `createWorld()` exposes `modelsReady`, which `App`
  awaits (10 s cap) before `buildMeshes()` so beacons bind to GLB meshes.

## First 5 real models (Step 2)

Authored by `tools/make_models.py` (dependency-free glTF 2.0 writer; re-run to
regenerate). License-clean, dimension-exact per `docs/coordinate-system.md`:

| File | Content | Real dims | Used by |
|---|---|---|---|
| `chair.glb` | Airport beam seat + backrest + legs | seat 0.50×0.55 @0.45 H | `SEATING-A01…A03` — 1 load, 30 GPU instances (`createInstance`) in the gate 2×5 grids |
| `security_gate.glb` | Detector arch + lintel + green LED strip | opening W 0.90, H 2.20 | `SECURITY-001/002` — 1:1 swap of `archL/R/T` at the same coords |
| `fids_board.glb` | Hanging cabinet, `ScreenFront`/`ScreenBack` | 5.6×2.4×0.35 @3.4–3.6 H | `FIDS-001/002` — live `fidsTexture()` rows painted onto the named screens post-load |
| `aircraft_a320.glb` | A320: fuselage, nose, tailcone, swept wings + sharklets, fin, H-stabs, 2 engines + fan discs, cockpit glazing, window bands, cheatline, full gear | L 37.6, span 35.8, tail 11.76 | `AIRCRAFT-001` at (0,0,45), nose +X; fuselage/wings collidable |
| `human.glb` | Low-poly pax 1.75 m (legs, torso, arms, head + hair) | 1.75 base | `PAX-QUEUE-01` — 1 load, 6 instances scaled 0.94–1.06 (1.65–1.85 m) queued at Check-in 1 |

Any CC0 GLB (poly.pizza, Quaternius, Khronos samples) can replace these files
without code changes — keep the screen meshes named `ScreenFront`/`ScreenBack`
for the live FIDS paint, then update `model_path` only.
