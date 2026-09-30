import {
  Color3,
  Color4,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { Mats } from './materials';

function applyDecalQuality(dt: DynamicTexture): void {
  dt.anisotropicFilteringLevel = 8;
  dt.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
}

/**
 * FINAL REALISM PASS — visual environment only.
 * No changes to layout, aircraft, people, baggage, UI, or twin logic.
 *
 * Builds:
 *  1. Sky-dome gradient (horizon light -> zenith deeper) + sun glow disc
 *  2. Far terrain base + near grass infill (irregular, muted)
 *  3. Taxiway loop connecting apron -> wider field, with ground-hugging markings
 *  4. Curbs / pavement edges / terrain transitions
 *  5. Distant background scenery (hangars, tower silhouette, low blocks, perimeter,
 *     distant tails) — cheap, non-pickable, non-interactive
 *  6. Blob contact-shadow decals + terminal foundation AO strip
 *  7. Subtle atmospheric fog for depth (airport stays clear)
 */

function radialShadowTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(8,10,12,0.55)');
  grad.addColorStop(0.55, 'rgba(8,10,12,0.28)');
  grad.addColorStop(1, 'rgba(8,10,12,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const dt = new DynamicTexture('blobShadow', c, scene, true);
  dt.hasAlpha = true;
  dt.wrapU = dt.wrapV = Texture.CLAMP_ADDRESSMODE;
  applyDecalQuality(dt);
  return dt;
}

function blob(
  scene: Scene,
  parent: TransformNode,
  tex: DynamicTexture,
  name: string,
  x: number,
  z: number,
  w: number,
  d: number,
  opacity = 0.85,
  y = 0.05, // above apron paint boxes (top ~0.04) — no clipping
): Mesh {
  const m = MeshBuilder.CreatePlane(name, { width: w, height: d }, scene);
  m.parent = parent;
  m.position.set(x, y, z);
  m.rotation.x = -Math.PI / 2; // face up onto ground (visible from above)
  const mat = new PBRMaterial(`${name}_mat`, scene);
  mat.albedoTexture = tex;
  mat.opacityTexture = tex;
  mat.albedoColor = new Color3(0, 0, 0);
  mat.roughness = 1.0;
  mat.metallic = 0.0;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  mat.unlit = true;
  mat.alpha = opacity;
  mat.disableLighting = true;
  m.material = mat;
  m.isPickable = false;
  m.checkCollisions = false;
  return m;
}

function skyGradientTexture(scene: Scene): DynamicTexture {
  const w = 16;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, h);
  // v=0 is top of texture; dome UVs put horizon near middle — paint full ramp:
  // zenith (top) -> mid sky -> warm horizon glow -> below-horizon ground haze
  grad.addColorStop(0.0, '#2f5e9e'); // zenith, natural daylight blue
  grad.addColorStop(0.42, '#6f9cc8');
  grad.addColorStop(0.52, '#c3d6e4'); // horizon: pale, luminous
  grad.addColorStop(0.56, '#dfe4e2'); // warm haze band right at horizon
  grad.addColorStop(0.6, '#b9bfae'); // melts into distant ground
  grad.addColorStop(1.0, '#8a8f7d');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const dt = new DynamicTexture('skyGradient', c, scene, true);
  dt.hasAlpha = false;
  dt.wrapU = Texture.CLAMP_ADDRESSMODE;
  dt.wrapV = Texture.CLAMP_ADDRESSMODE;
  applyDecalQuality(dt);
  return dt;
}

export function buildEnvironment(scene: Scene, mats: Mats, world: TransformNode): void {
  const env = new TransformNode('ENVIRONMENT', scene);
  env.parent = world;

  // ------------------------------------------------------------------
  // 1. SKY DOME + ATMOSPHERE
  // ------------------------------------------------------------------
  scene.clearColor = new Color4(0.76, 0.84, 0.9, 1.0);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 220;
  scene.fogEnd = 900; // subtle: only far field softens, apron stays crisp
  scene.fogColor = new Color3(0.78, 0.83, 0.88);

  const skyTex = skyGradientTexture(scene);
  const skyMat = new PBRMaterial('skyDomeMat', scene);
  skyMat.albedoTexture = skyTex;
  skyMat.emissiveTexture = skyTex;
  skyMat.emissiveColor = new Color3(1, 1, 1);
  skyMat.albedoColor = new Color3(0, 0, 0);
  skyMat.roughness = 1.0;
  skyMat.metallic = 0.0;
  skyMat.unlit = true;
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  const sky = MeshBuilder.CreateSphere('skyDome', { diameter: 1500, segments: 24 }, scene);
  sky.parent = env;
  sky.position.set(0, 60, 0);
  sky.material = skyMat;
  sky.isPickable = false;
  sky.checkCollisions = false;
  sky.infiniteDistance = true;
  sky.applyFog = false;

  // Soft sun glow disc, aligned with the directional light direction
  const sunGlow = MeshBuilder.CreatePlane('sunGlow', { width: 130, height: 130 }, scene);
  sunGlow.parent = env;
  sunGlow.position.set(330, 480, -190);
  sunGlow.lookAt(new Vector3(0, 0, 40));
  const sc = document.createElement('canvas');
  sc.width = sc.height = 256;
  const sg = sc.getContext('2d')!;
  const sgrad = sg.createRadialGradient(128, 128, 8, 128, 128, 128);
  sgrad.addColorStop(0, 'rgba(255,252,240,0.95)');
  sgrad.addColorStop(0.25, 'rgba(255,250,230,0.45)');
  sgrad.addColorStop(1, 'rgba(255,250,230,0)');
  sg.fillStyle = sgrad;
  sg.fillRect(0, 0, 256, 256);
  const sunTex = new DynamicTexture('sunGlowTex', sc, scene, true);
  sunTex.hasAlpha = true;
  applyDecalQuality(sunTex);
  const sunMat = new PBRMaterial('sunGlowMat', scene);
  sunMat.albedoTexture = sunTex;
  sunMat.opacityTexture = sunTex;
  sunMat.emissiveColor = new Color3(1, 0.98, 0.92);
  sunMat.roughness = 1.0;
  sunMat.metallic = 0.0;
  sunMat.unlit = true;
  sunMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  sunMat.disableLighting = true;
  sunGlow.material = sunMat;
  sunGlow.isPickable = false;
  sunGlow.applyFog = false;

  // ------------------------------------------------------------------
  // 2. TERRAIN — far base + near infill (apron stays the hero)
  // ------------------------------------------------------------------
  const farField = MeshBuilder.CreateGround('farTerrain', { width: 1400, height: 1400 }, scene);
  farField.parent = env;
  farField.position.set(0, -0.12, 60);
  farField.material = mats.grass;
  farField.isPickable = false;
  farField.checkCollisions = false;
  farField.receiveShadows = true;
  mats.grass.albedoTexture!.wrapU = mats.grass.albedoTexture!.wrapV = Texture.WRAP_ADDRESSMODE;
  (mats.grass.albedoTexture as Texture).uScale = 90;
  (mats.grass.albedoTexture as Texture).vScale = 90;

  // Near-field grass patches with slightly irregular edges around the paved core.
  // Paved core spans roughly x[-39,39], z[-69,66]; patches fill the gaps.
  const patch = (n: string, w: number, d: number, x: number, z: number, ry = 0) => {
    const m = MeshBuilder.CreateGround(n, { width: w, height: d }, scene);
    m.parent = env;
    m.position.set(x, -0.02, z);
    m.rotation.y = ry;
    m.material = mats.grass;
    m.isPickable = false;
    m.checkCollisions = false;
    m.receiveShadows = true;
    return m;
  };
  patch('grassWest', 60, 190, -155, 10, 0.04);
  patch('grassEast', 60, 190, 155, 10, -0.03);
  patch('grassNorth', 340, 60, 0, 100, 0.02);
  patch('grassSouth', 320, 40, 0, -92, -0.02);
  patch('grassNE', 90, 55, 95, 78, 0.35);
  patch('grassNW', 90, 55, -95, 78, -0.3);

  // ------------------------------------------------------------------
  // 3. TAXIWAY — parallel taxiway + connector to stand A12 apron
  // ------------------------------------------------------------------
  // Apron occupies z 18..66. Taxiway runs east-west beyond the service road.
  const taxiway = MeshBuilder.CreateGround('taxiwayA', { width: 520, height: 15 }, scene);
  taxiway.parent = env;
  taxiway.position.set(0, 0.015, 84);
  taxiway.material = mats.taxiwayAsphalt;
  taxiway.isPickable = false;
  taxiway.checkCollisions = false;
  taxiway.receiveShadows = true;
  (mats.taxiwayAsphalt.albedoTexture as Texture).uScale = 12;
  (mats.taxiwayAsphalt.albedoTexture as Texture).vScale = 1;

  // Connector stub: apron -> taxiway (aircraft path), narrower
  const link = MeshBuilder.CreateGround('taxiwayLinkA12', { width: 16, height: 22 }, scene);
  link.parent = env;
  link.position.set(0, 0.028, 72); // sits just above service road (y 0.02) — no z-fighting
  link.material = mats.taxiwayAsphalt;
  link.isPickable = false;
  link.receiveShadows = true;

  // Ground-hugging painted centerline on the link (thin decal planes, no float/clip)
  const paintMat = (n: string, color: Color3, emissive: Color3) => {
    const m = new PBRMaterial(n, scene);
    m.albedoColor = color;
    m.emissiveColor = emissive;
    m.roughness = 0.9;
    m.metallic = 0.0;
    m.unlit = true;
    return m;
  };
  const taxiYellow = paintMat('taxiPaintYellow', new Color3(0.62, 0.52, 0.12), new Color3(0.1, 0.085, 0.015));
  const dash = (n: string, w: number, d: number, x: number, z: number) => {
    const p = MeshBuilder.CreatePlane(n, { width: w, height: d }, scene);
    p.parent = env;
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.045, z);
    p.material = taxiYellow;
    p.isPickable = false;
    return p;
  };
  // dashes along the link centerline (follow ground, realistic proportion)
  for (let z = 63; z <= 90; z += 4.5) dash(`linkDash_${z}`, 0.45, 3.0, 0, z);
  // dashes along the parallel taxiway centerline
  const hDash = (n: string, x: number) => {
    const p = MeshBuilder.CreatePlane(n, { width: 3.0, height: 0.45 }, scene);
    p.parent = env;
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.04, 84);
    p.material = taxiYellow;
    p.isPickable = false;
    return p;
  };
  for (let x = -250; x <= 250; x += 7) {
    if (Math.abs(x) < 11) continue; // gap at the link junction
    hDash(`twDash_${x}`, x);
  }

  // ------------------------------------------------------------------
  // 4. TRANSITIONS — curbs & pavement edges (no hard plane seams)
  // ------------------------------------------------------------------
  const curbMat = new PBRMaterial('curbConcrete', scene);
  curbMat.albedoColor = new Color3(0.55, 0.56, 0.57);
  curbMat.roughness = 0.85;
  curbMat.metallic = 0.0;
  const curb = (n: string, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    m.parent = env;
    m.position.set(x, y, z);
    m.material = curbMat;
    m.isPickable = false;
    m.checkCollisions = false;
    m.receiveShadows = true;
    return m;
  };
  // apron perimeter curbs (low, subtle) — sized to the widened 250m apron
  curb('curbApronN', 248, 0.18, 0.5, 0, 0.05, 74.2);
  curb('curbApronS', 248, 0.18, 0.5, 0, 0.05, 13.8);
  curb('curbApronW', 0.5, 0.18, 60.4, -125.2, 0.05, 44);
  curb('curbApronE', 0.5, 0.18, 60.4, 125.2, 0.05, 44);
  // taxiway shoulders (flush edge strips, slightly darker)
  const shoulderMat = paintMat('twShoulder', new Color3(0.2, 0.21, 0.22), new Color3(0, 0, 0));
  const shoulder = (n: string, w: number, x: number, z: number) => {
    const p = MeshBuilder.CreatePlane(n, { width: w, height: 1.6 }, scene);
    p.parent = env;
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.03, z);
    p.material = shoulderMat;
    p.isPickable = false;
    return p;
  };
  shoulder('twShoulderN', 520, 0, 77.2);
  shoulder('twShoulderS', 520, 0, 90.8);

  // ------------------------------------------------------------------
  // 5. DISTANT BACKGROUND SCENERY — cheap, subtle, non-interactive
  // ------------------------------------------------------------------
  const bg = new TransformNode('DISTANT_BG', scene);
  bg.parent = env;
  const flat = (c: Color3) => {
    const m = new PBRMaterial(`bg_${c.r.toFixed(2)}_${Math.random().toFixed(3)}`, scene);
    m.albedoColor = c;
    m.roughness = 0.8;
    m.metallic = 0.05;
    return m;
  };
  const hangarMat = flat(new Color3(0.52, 0.55, 0.58));
  const roofMat = flat(new Color3(0.35, 0.38, 0.42));
  const towerMat = flat(new Color3(0.6, 0.62, 0.65));
  const glassBand = new PBRMaterial('bgGlassBand', scene);
  glassBand.albedoColor = new Color3(0.25, 0.38, 0.5);
  glassBand.emissiveColor = new Color3(0.08, 0.14, 0.18);
  glassBand.roughness = 0.15;
  glassBand.metallic = 0.4;

  const block = (n: string, w: number, h: number, d: number, x: number, z: number, m: PBRMaterial, ry = 0) => {
    const b = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    b.parent = bg;
    b.position.set(x, h / 2 - 0.1, z);
    b.rotation.y = ry;
    b.material = m;
    b.isPickable = false;
    b.checkCollisions = false;
    return b;
  };
  // Distant hangars row (north-east field)
  block('bgHangar1', 46, 11, 30, -95, 150, hangarMat, 0.06);
  block('bgHangar1Roof', 47, 1.2, 31, -95, 150, roofMat, 0.06).position.y = 11.4;
  block('bgHangar2', 38, 9, 26, -40, 158, hangarMat, -0.04);
  block('bgHangar3', 52, 12, 32, 60, 155, hangarMat, 0.03);
  block('bgHangar3Roof', 53, 1.2, 33, 60, 155, roofMat, 0.03).position.y = 12.4;
  block('bgHangar4', 34, 8, 24, 125, 148, hangarMat, -0.05);
  // Control tower silhouette (north-west)
  const towerShaft = block('bgTower', 7, 34, 7, -150, 120, towerMat);
  towerShaft.position.y = 17;
  block('bgTowerCab', 13, 5, 13, -150, 120, towerMat).position.y = 36;
  block('bgTowerGlass', 13.4, 2.0, 13.4, -150, 120, glassBand).position.y = 36.4;
  block('bgTowerRoof', 10, 1.0, 10, -150, 120, roofMat).position.y = 39;
  // Low service / cargo blocks (east + west, muted)
  block('bgCargo1', 30, 6, 18, 150, 60, hangarMat, 0.1);
  block('bgCargo2', 24, 5, 16, -155, 40, hangarMat, -0.08);
  block('bgCargo3', 20, 4.5, 14, 120, -60, hangarMat, 0.0);
  block('bgCargo4', 22, 5, 15, -120, -70, hangarMat, 0.05);
  // Distant parked aircraft tails (simple fuselage + fin hints, very cheap)
  const tailMat = flat(new Color3(0.75, 0.77, 0.8));
  const distantStand = (n: string, x: number, z: number, ry: number) => {
    const g = new TransformNode(n, scene);
    g.parent = bg;
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const f = MeshBuilder.CreateCapsule(`${n}_f`, { radius: 1.6, capSubdivisions: 3, subdivisions: 2, height: 1.6, radiusTop: 1.6 }, scene);
    (f as Mesh).parent = g;
    (f as Mesh).rotation.z = Math.PI / 2;
    (f as Mesh).position.set(0, 2.6, 0);
    (f as Mesh).scaling.set(1, 1, 1);
    (f as Mesh).material = tailMat;
    (f as Mesh).isPickable = false;
    const fin = MeshBuilder.CreateBox(`${n}_fin`, { width: 0.5, height: 6, depth: 4 }, scene);
    fin.parent = g;
    fin.position.set(-11, 6, 0);
    fin.material = tailMat;
    fin.isPickable = false;
  };
  distantStand('bgTail1', -70, 120, 0.2);
  distantStand('bgTail2', 30, 125, -0.15);
  distantStand('bgTail3', 95, 118, 0.1);
  // Perimeter service road ring hint + fence posts (instanced cheap boxes)
  const fenceMat = flat(new Color3(0.4, 0.42, 0.44));
  const fencePost = MeshBuilder.CreateBox('fencePostProto', { width: 0.18, height: 2.2, depth: 0.18 }, scene);
  fencePost.material = fenceMat;
  fencePost.isPickable = false;
  fencePost.isVisible = false;
  for (let x = -260; x <= 260; x += 12) {
    for (const z of [108, -100]) {
      const i = fencePost.createInstance(`fence_${x}_${z}`);
      i.parent = bg;
      i.position.set(x, 1.0, z);
    }
  }
  const periMat = paintMat('periRoad', new Color3(0.23, 0.24, 0.25), new Color3(0, 0, 0));
  const peri = MeshBuilder.CreateGround('periRoadN', { width: 560, height: 4 }, scene);
  peri.parent = bg;
  peri.position.set(0, 0.0, 104);
  peri.material = periMat;
  peri.isPickable = false;

  // ------------------------------------------------------------------
  // 6. CONTACT SHADOWS + FOUNDATION AO (kill the "floating model" look)
  // ------------------------------------------------------------------
  const blobTex = radialShadowTexture(scene);
  const contact = new TransformNode('CONTACT_SHADOWS', scene);
  contact.parent = env;

  // Aircraft gears (stand A12 — matches aircraft.ts gear coordinates)
  blob(scene, contact, blobTex, 'csNoseGear', 12.2, 45, 3.4, 2.6, 0.9);
  blob(scene, contact, blobTex, 'csMainL', -0.5, 41.8, 4.6, 3.4, 0.9);
  blob(scene, contact, blobTex, 'csMainR', -0.5, 48.2, 4.6, 3.4, 0.9);
  // Engine shadows (broad soft grounding under nacelles)
  blob(scene, contact, blobTex, 'csEngL', 0.6, 41.5, 7.5, 3.2, 0.5, 0.048);
  blob(scene, contact, blobTex, 'csEngR', 0.6, 48.5, 7.5, 3.2, 0.5, 0.048);
  // Belly soft band under fuselage
  blob(scene, contact, blobTex, 'csBelly', -1, 45, 26, 5.5, 0.35, 0.047);
  // Side stands B14 / C16 (dx = ±62): gear + belly grounding
  for (const sx of [-62, 62]) {
    blob(scene, contact, blobTex, `csNoseGear_${sx}`, 12.2 + sx, 45, 3.4, 2.6, 0.9);
    blob(scene, contact, blobTex, `csMainL_${sx}`, -0.5 + sx, 41.8, 4.6, 3.4, 0.9);
    blob(scene, contact, blobTex, `csMainR_${sx}`, -0.5 + sx, 48.2, 4.6, 3.4, 0.9);
    blob(scene, contact, blobTex, `csBelly_${sx}`, -1 + sx, 45, 26, 5.5, 0.35, 0.047);
  }

  // Ground equipment / vehicles (apron coords from vehicles.ts)
  blob(scene, contact, blobTex, 'csGPU', 4.8, 41.5, 3.2, 2.4, 0.8);
  blob(scene, contact, blobTex, 'csTug', 0, 53, 4.4, 3.2, 0.8);
  blob(scene, contact, blobTex, 'csBus', 14, 62, 12.5, 4.0, 0.7);
  blob(scene, contact, blobTex, 'csCater', -4.5, 51.5, 8.5, 3.6, 0.7);
  blob(scene, contact, blobTex, 'csFuel', 4, 52.5, 5.8, 3.2, 0.7);
  blob(scene, contact, blobTex, 'csBagTractor', -6.5, 40, 2.8, 2.4, 0.8);
  for (let i = 0; i < 3; i++) blob(scene, contact, blobTex, `csDolly_${i}`, -3.5 + i * 2.8, 40, 3.0, 2.3, 0.75);

  // Terminal foundation AO: long soft strip along landside + airside base
  const aoMat = new PBRMaterial('foundationAO', scene);
  aoMat.albedoColor = new Color3(0, 0, 0);
  aoMat.alpha = 0.22;
  aoMat.roughness = 1.0;
  aoMat.metallic = 0.0;
  aoMat.unlit = true;
  aoMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
  aoMat.disableLighting = true;
  const aoStrip = (n: string, w: number, d: number, x: number, z: number) => {
    const p = MeshBuilder.CreatePlane(n, { width: w, height: d }, scene);
    p.parent = contact;
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.028, z);
    p.material = aoMat;
    p.isPickable = false;
  };
  aoStrip('aoSouth', 68, 1.6, 0, -19.0);
  aoStrip('aoNorth', 68, 1.6, 0, 19.0);
  aoStrip('aoEast', 1.6, 38, 33.2, 0);
  aoStrip('aoWest', 1.6, 38, -33.2, 0);

  // ------------------------------------------------------------------
  // 7. MATERIAL RESPONSE — per-surface light behavior (PBR roughness/metallic)
  // ------------------------------------------------------------------
  // Apron: moderate roughness, subtle sheen (concrete, not mirror)
  mats.asphalt.roughness = 0.82;
  mats.asphalt.metallic = 0.0;
  // Taxiway: dark asphalt, low reflection
  mats.taxiwayAsphalt.roughness = 0.94;
  mats.taxiwayAsphalt.metallic = 0.0;
  // Vehicles paint already PBR — keep moderate (no change).
  // Glass: reflective but controlled
  mats.glass.directIntensity = 1.1;
  // Grass stays fully diffuse (PBR roughness 0.96, metallic 0 — set in materials).
}
