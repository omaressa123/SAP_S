# Coordinate System

- Unit: 1 = 1 meter. Up axis: +Y. Forward: +Z (Babylon left-handed).
- Blender export (glTF): +Y Up, apply scale/rotation before export, origin at floor level.
- Static transforms live in the scene file (`registry.json`); only moving assets (robots) store dynamic transforms in the backend.

## Real-world reference dimensions (Step 1 realism pass)

All new scene elements must use these documented measures — no guessing.
Sources: ICAO Annex 14 + standard airport planning figures + A320 specs.

| Element | Value | Notes |
|---|---|---|
| Terminal hall clear ceiling height | 4–6 m | Double-height departure hall ≈ 5 m |
| Security / boarding lane width | 1.2–1.5 m | Per person lane |
| Waiting seat (per place) | W 0.50 m, D 0.55 m, seat H 0.45 m | Standard beam seating |
| Check-in counter | H 1.10 m, depth 0.80 m | With bag-weigh belt |
| FIDS board mounting height | bottom edge ≥ 2.20 m | Above head, readable at 10–15 m |
| Metal detector gate | W 0.90 m opening, H 2.20 m, D 0.60 m | Standard arch |
| X-ray belt | H 0.80 m bed, W 0.65 m | At checkpoints |
| Human height | 1.65–1.85 m, varied | Never uniform; eye height ≈ 1.60–1.70 m (FP camera 1.70 m) |
| A320 reference | length 37.57 m, wingspan 35.80 m, tail H 11.76 m | Bind exterior dims to this |
| FPS walker | eye 1.70 m, ellipsoid (0.35, 0.85, 0.35) | Sprint 0.65, walk 0.25 |
| FP camera FOV | 1.35 rad (~77°) | Realistic range 75–90° |
| TP camera FOV | 1.30 rad (~74°) | Fixed offset, collision on |

## Rendering (Step 1)

- Tone mapping: ACES, exposure 1.1, contrast 1.15 (`buildImageProcessingAndIBL` in `engine/lighting.ts`).
- IBL: prefiltered `.env` loaded as `scene.environmentTexture` with `environmentIntensity 0.65`; offline fallback = sun + hemi only.
- Shadows: sun `DirectionalLight` + `ShadowGenerator` 4096 PCF-blur; blob decals kept as grounding assist.
- All materials are `PBRMaterial` (no `StandardMaterial` left in `src/`); canvas textures use trilinear mipmaps + 8x anisotropic filtering.
- Post-process: `DefaultRenderingPipeline` (4x MSAA + sharpen) + `SSAO2RenderingPipeline` at half ratio, guarded by try/catch.
