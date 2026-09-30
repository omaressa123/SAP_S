import { Color3, Material, Mesh, MeshBuilder, Scene, PBRMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { Mats, textPlate } from './materials';

export interface VehiclesTick {
  update(dt: number, t: number): void;
}

function box(
  scene: Scene,
  m: Material,
  parent: TransformNode,
  n: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  solid = false,
  ry = 0,
): Mesh {
  const mesh = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.material = m;
  mesh.checkCollisions = solid;
  mesh.isPickable = false;
  return mesh;
}

function cyl(
  scene: Scene,
  m: Material,
  parent: TransformNode,
  n: string,
  h: number,
  dia: number,
  x: number,
  y: number,
  z: number,
  solid = false,
): Mesh {
  const mesh = MeshBuilder.CreateCylinder(n, { height: h, diameter: dia, tessellation: 20 }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = m;
  mesh.checkCollisions = solid;
  mesh.isPickable = false;
  return mesh;
}

function wheel(
  scene: Scene,
  mats: Mats,
  parent: TransformNode,
  n: string,
  x: number,
  z: number,
  dia = 0.85,
  y?: number,
  width = 0.35,
) {
  const w = MeshBuilder.CreateCylinder(n, { height: width, diameter: dia, tessellation: 20 }, scene);
  w.parent = parent;
  w.rotation.z = Math.PI / 2;
  w.position.set(x, y ?? dia / 2, z);
  w.material = mats.tire;
  w.isPickable = false;

  const hub = MeshBuilder.CreateCylinder(`${n}_hub`, { height: width + 0.02, diameter: dia * 0.52, tessellation: 16 }, scene);
  hub.parent = parent;
  hub.rotation.z = Math.PI / 2;
  hub.position.copyFrom(w.position);
  hub.material = mats.chrome;
  hub.isPickable = false;

  return w;
}

/** Helper to build a passenger sedan/SUV car */
function createCar(
  scene: Scene,
  mats: Mats,
  parent: TransformNode,
  name: string,
  bodyColor: Color3,
  x: number,
  y: number,
  z: number,
  rotY = 0,
) {
  const car = new TransformNode(name, scene);
  car.parent = parent;
  car.position.set(x, y, z);
  car.rotation.y = rotY;

  const paint = new PBRMaterial(`${name}_paint`, scene);
  paint.albedoColor = bodyColor;

  box(scene, paint, car, 'carBody', 2.2, 0.75, 4.8, 0, 0.65, 0, true);
  box(scene, mats.cockpitGlass, car, 'carCabin', 1.85, 0.65, 2.5, 0, 1.35, 0);

  const hLight = box(scene, mats.white, car, 'hLight', 1.8, 0.18, 0.08, 0, 0.7, 2.42);
  hLight.material = textPlate(scene, '● ●', { bg: '#fef08a', fg: '#fef08a' });
  const tLight = box(scene, mats.white, car, 'tLight', 1.8, 0.18, 0.08, 0, 0.7, -2.42);
  tLight.material = textPlate(scene, '● ●', { bg: '#dc2626', fg: '#dc2626' });

  [[-1.05, -1.6], [1.05, -1.6], [-1.05, 1.6], [1.05, 1.6]].forEach(([dx, dz], k) => {
    wheel(scene, mats, car, `carW_${name}_${k}`, dx, dz, 0.76, 0.38, 0.32);
  });

  return car;
}

/**
 * Apron Ground Support Equipment & Landside Road Moving / Parked Vehicles:
 * - Animated Car entering the airport from highway into parking
 * - Parked cars in Parking P1 & Drop-Off Curbside
 * - Pushback Tug (TUG-001) & Towbar
 * - Baggage Train (BAGGAGE-001)
 * - Apron Shuttle Bus (BUS-001)
 * - Ground Power Unit (GPU-001)
 * - Catering High-Loader (CATER-001)
 * - Fuel Hydrant Dispenser (FUEL-001)
 */
export function buildGroundOps(scene: Scene, mats: Mats, host: TransformNode): VehiclesTick {
  // 1. APRON TARMAC SLAB & STAND A12 MARKINGS
  const apron = MeshBuilder.CreateGround('apronTarmac', { width: 250, height: 60 }, scene);
  apron.parent = host;
  apron.position.set(0, 0.01, 44);
  apron.material = mats.asphalt;
  apron.checkCollisions = true;
  apron.isPickable = false;

  const taxiLineMat = new PBRMaterial('taxiLineMat', scene);
  taxiLineMat.albedoColor = new Color3(0.96, 0.78, 0.08);
  taxiLineMat.emissiveColor = new Color3(0.45, 0.35, 0.02);

  box(scene, taxiLineMat, host, 'leadInCenterline', 0.45, 0.02, 28, 0, 0.03, 52, false);
  box(scene, taxiLineMat, host, 'standLineL', 0.4, 0.02, 32, -10.5, 0.03, 45, false);
  box(scene, taxiLineMat, host, 'standLineR', 0.4, 0.02, 32, 10.5, 0.03, 45, false);
  box(scene, taxiLineMat, host, 'standLineB', 21.4, 0.02, 0.4, 0, 0.03, 31.0, false);

  const redHazardMat = new PBRMaterial('redHazardMat', scene);
  redHazardMat.albedoColor = new Color3(0.85, 0.15, 0.15);
  box(scene, redHazardMat, host, 'hazardLineL', 0.35, 0.02, 24, -13.5, 0.03, 45, false);
  box(scene, redHazardMat, host, 'hazardLineR', 0.35, 0.02, 24, 13.5, 0.03, 45, false);

  const standNumSign = MeshBuilder.CreatePlane('standNumA12', { width: 7.2, height: 3.6 }, scene);
  standNumSign.parent = host;
  standNumSign.rotation.x = -Math.PI / 2;
  standNumSign.position.set(0, 0.04, 34.5);
  standNumSign.material = textPlate(scene, 'STAND  A12', {
    bg: '#18181b',
    fg: '#facc15',
    font: 72,
    border: '#facc15',
    sub: 'MAX A321 / B737-900',
  });
  for (const [sx, label, sub] of [[-62, 'STAND  B14', 'MAX A320'], [62, 'STAND  C16', 'MAX B737-800']] as [number, string, string][]) {
    const s = MeshBuilder.CreatePlane(`standNum${label.replace(/\s/g, '')}`, { width: 7.2, height: 3.6 }, scene);
    s.parent = host;
    s.rotation.x = -Math.PI / 2;
    s.position.set(sx, 0.04, 38.5);
    s.material = textPlate(scene, label, { bg: '#18181b', fg: '#facc15', font: 72, border: '#facc15', sub });
    box(scene, taxiLineMat, host, `standLineB_${label}`, 21.4, 0.02, 0.4, sx, 0.03, 35.0, false);
    // Side-stand lead-in + sidelines so each parking position reads as its own stand
    box(scene, taxiLineMat, host, `leadIn_${label}`, 0.45, 0.02, 28, sx, 0.03, 52, false);
    box(scene, taxiLineMat, host, `standLineL_${label}`, 0.4, 0.02, 32, sx - 10.5, 0.03, 45, false);
    box(scene, taxiLineMat, host, `standLineR_${label}`, 0.4, 0.02, 32, sx + 10.5, 0.03, 45, false);
  }

  box(scene, taxiLineMat, host, 'noseStopBar', 3.2, 0.02, 0.6, 0, 0.035, 37.2, false);

  const serviceRoad = MeshBuilder.CreateGround('apronServiceRoad', { width: 250, height: 6 }, scene);
  serviceRoad.parent = host;
  serviceRoad.position.set(0, 0.02, 66);
  serviceRoad.material = mats.road;
  serviceRoad.isPickable = false;

  // =========================================================================
  // 2. GROUND POWER UNIT (GPU-001)
  // =========================================================================
  const GPU = new TransformNode('GPU-001', scene);
  GPU.parent = host;
  box(scene, mats.white, GPU, 'gpuChassis', 2.2, 1.35, 1.4, 4.8, 0.85, 41.5, true);
  const gpuPanel = box(scene, mats.darkMetal, GPU, 'gpuPanel', 1.4, 0.65, 0.08, 4.8, 1.0, 40.75);
  gpuPanel.material = textPlate(scene, '400 Hz  115V  ● ACTIVE', { bg: '#0f172a', fg: '#4ade80', font: 38 });
  box(scene, mats.darkMetal, GPU, 'gpuLouver', 1.6, 0.45, 0.08, 4.8, 1.0, 42.25);

  const gpuBeacon = MeshBuilder.CreateSphere('gpuBeacon', { diameter: 0.18 }, scene);
  gpuBeacon.parent = GPU;
  gpuBeacon.position.set(4.8, 1.62, 41.5);
  const gpuBMat = new PBRMaterial('gpuBM', scene);
  gpuBMat.albedoColor = new Color3(1, 0.6, 0.1);
  gpuBMat.emissiveColor = new Color3(1, 0.5, 0.05);
  gpuBeacon.material = gpuBMat;

  wheel(scene, mats, GPU, 'gpuW1', 4.0, 41.5, 0.65, 0.32, 0.22);
  wheel(scene, mats, GPU, 'gpuW2', 5.6, 41.5, 0.65, 0.32, 0.22);

  const cableMat = new PBRMaterial('gpuCableMat', scene);
  cableMat.albedoColor = new Color3(0.95, 0.8, 0.1);
  box(scene, cableMat, GPU, 'gpuPowerCable', 3.8, 0.08, 0.12, 2.6, 0.08, 42.8);

  // =========================================================================
  // 3. BAGGAGE CART TRAIN (BAGGAGE-001)
  // =========================================================================
  const BC = new TransformNode('BAGGAGE-001', scene);
  BC.parent = host;

  const tugTractor = new TransformNode('bagTractor', scene);
  tugTractor.parent = BC;
  const tractorMat = new PBRMaterial('tractM', scene);
  tractorMat.albedoColor = new Color3(0.95, 0.8, 0.08);
  box(scene, tractorMat, tugTractor, 'tracBody', 1.8, 0.85, 1.4, -6.5, 0.65, 40.0, true);
  box(scene, mats.darkMetal, tugTractor, 'tracCab', 1.4, 0.8, 1.2, -6.8, 1.35, 40.0);
  box(scene, mats.darkMetal, tugTractor, 'tracSeat', 0.55, 0.45, 0.55, -6.6, 0.95, 40.0);
  wheel(scene, mats, tugTractor, 'tracW1', -7.2, 39.4, 0.65, 0.32);
  wheel(scene, mats, tugTractor, 'tracW2', -7.2, 40.6, 0.65, 0.32);
  wheel(scene, mats, tugTractor, 'tracW3', -5.8, 39.4, 0.65, 0.32);
  wheel(scene, mats, tugTractor, 'tracW4', -5.8, 40.6, 0.65, 0.32);

  const baggageColors = [new Color3(0.75, 0.2, 0.2), new Color3(0.18, 0.38, 0.72), new Color3(0.2, 0.55, 0.28)];
  for (let i = 0; i < 3; i++) {
    const x = -3.5 + i * 2.8;
    box(scene, mats.steel, BC, `dollyBed_${i}`, 2.2, 0.18, 1.45, x, 0.55, 40.0, true);
    for (const [dx, dz] of [[-0.85, -0.65], [0.85, -0.65], [-0.85, 0.65], [0.85, 0.65]]) {
      wheel(scene, mats, BC, `dollyW_${i}_${dx}_${dz}`, x + dx, 40.0 + dz, 0.45, 0.22, 0.18);
    }
    box(scene, mats.darkMetal, BC, `dollyRailL_${i}`, 2.2, 0.55, 0.08, x, 0.92, 39.3);
    box(scene, mats.darkMetal, BC, `dollyRailR_${i}`, 2.2, 0.55, 0.08, x, 0.92, 40.7);

    const bagMat = new PBRMaterial(`bagStackM_${i}`, scene);
    bagMat.albedoColor = baggageColors[i % 3];
    box(scene, bagMat, BC, `dollyBags_${i}`, 1.8, 0.85, 1.25, x, 1.05, 40.0);
    box(scene, mats.darkMetal, BC, `dollyTowbar_${i}`, 1.2, 0.08, 0.08, x + 1.8, 0.42, 40.0);
  }

  // =========================================================================
  // 4. PUSHBACK TUG (TUG-001)
  // =========================================================================
  const TUG = new TransformNode('TUG-001', scene);
  TUG.parent = host;
  const tugPaint = new PBRMaterial('tugPaintMat', scene);
  tugPaint.albedoColor = new Color3(0.95, 0.78, 0.08);

  box(scene, tugPaint, TUG, 'tugChassis', 3.4, 0.95, 2.0, 0, 0.78, 53.0, true);
  box(scene, mats.darkMetal, TUG, 'tugCabFrame', 1.4, 0.85, 1.8, -0.4, 1.55, 53.0);
  box(scene, mats.cockpitGlass, TUG, 'tugCabGlass', 1.3, 0.75, 1.7, -0.4, 1.55, 53.0);

  const beaconBar = box(scene, mats.white, TUG, 'tugBeaconBar', 0.4, 0.22, 1.4, -0.4, 2.05, 53.0);
  beaconBar.material = textPlate(scene, '⚠', { bg: '#eab308', fg: '#000000', font: 64 });

  for (const [dx, dz] of [[-1.2, -1.05], [1.2, -1.05], [-1.2, 1.05], [1.2, 1.05]]) {
    wheel(scene, mats, TUG, `tugW_${dx}_${dz}`, dx, 53.0 + dz, 0.95, 0.48, 0.42);
  }

  const towbarMat = new PBRMaterial('towbarM', scene);
  towbarMat.albedoColor = new Color3(0.85, 0.15, 0.15);
  box(scene, towbarMat, TUG, 'aircraftTowbar', 0.22, 0.22, 14.5, 0, 0.45, 45.0);
  wheel(scene, mats, TUG, 'tbW1', -0.35, 45.0, 0.4, 0.2, 0.12);
  wheel(scene, mats, TUG, 'tbW2', 0.35, 45.0, 0.4, 0.2, 0.12);

  // =========================================================================
  // 5. APRON SHUTTLE BUS (BUS-001)
  // =========================================================================
  const BUS = new TransformNode('BUS-001', scene);
  BUS.parent = host;
  const busMat = new PBRMaterial('busBodyMat', scene);
  busMat.albedoColor = new Color3(0.94, 0.95, 0.98);

  box(scene, busMat, BUS, 'busBody', 11.5, 2.6, 2.8, 14.0, 1.75, 62.0, true);
  box(scene, mats.cockpitGlass, BUS, 'busFrontGlass', 0.2, 1.4, 2.6, 19.8, 2.05, 62.0);
  for (let i = 0; i < 6; i++) {
    box(scene, mats.cockpitGlass, BUS, `busWinL_${i}`, 1.5, 1.1, 0.1, 9.5 + i * 1.8, 2.05, 60.55);
    box(scene, mats.cockpitGlass, BUS, `busWinR_${i}`, 1.5, 1.1, 0.1, 9.5 + i * 1.8, 2.05, 63.45);
  }

  box(scene, mats.darkMetal, BUS, 'busHvac1', 2.4, 0.35, 1.8, 11.5, 3.2, 62.0);
  box(scene, mats.darkMetal, BUS, 'busHvac2', 2.4, 0.35, 1.8, 16.5, 3.2, 62.0);

  const busDest = MeshBuilder.CreatePlane('busDestMarquee', { width: 2.6, height: 0.65 }, scene);
  busDest.parent = BUS;
  busDest.position.set(19.85, 2.85, 62.0);
  busDest.rotation.y = Math.PI / 2;
  busDest.material = textPlate(scene, 'TERMINAL ⇄ STAND A12', {
    bg: '#020617',
    fg: '#facc15',
    font: 36,
    sub: 'AIRPORT SHUTTLE',
  });

  for (const dx of [-3.8, 3.8]) {
    for (const dz of [-1.35, 1.35]) {
      wheel(scene, mats, BUS, `busW_${dx}_${dz}`, 14.0 + dx, 62.0 + dz, 1.05, 0.52, 0.38);
    }
  }

  // =========================================================================
  // 6. CATERING HIGH-LOADER TRUCK (CATER-001)
  // =========================================================================
  const CT = new TransformNode('CATER-001', scene);
  CT.parent = host;
  box(scene, mats.white, CT, 'caterChassis', 7.5, 0.65, 2.4, -4.0, 0.75, 51.5, true);
  box(scene, mats.white, CT, 'caterCab', 1.9, 1.6, 2.4, -0.8, 1.4, 51.5, true);
  box(scene, mats.cockpitGlass, CT, 'caterWindshield', 0.15, 0.85, 2.0, 0.2, 1.65, 51.5);

  box(scene, mats.darkMetal, CT, 'scissorStrutL', 0.25, 2.0, 0.25, -4.5, 1.35, 50.8);
  box(scene, mats.darkMetal, CT, 'scissorStrutR', 0.25, 2.0, 0.25, -4.5, 1.35, 52.2);

  const caterVan = box(scene, mats.white, CT, 'caterVanBody', 4.5, 2.4, 2.5, -5.2, 2.55, 51.5, true);
  caterVan.material = textPlate(scene, '✈ INFLIGHT CATERING', { bg: '#ffffff', fg: '#1e3a8a', font: 44 });

  box(scene, mats.steel, CT, 'caterBridgeCanopy', 1.4, 0.15, 1.2, -2.2, 2.55, 51.5);
  box(scene, mats.belt, CT, 'caterRubberBumper', 0.15, 1.8, 1.2, -1.45, 2.55, 51.5);

  for (const [dx, dz] of [[-6.8, -1.4], [-1.2, -1.4], [-6.8, 1.4], [-1.2, 1.4]]) {
    cyl(scene, mats.steel, CT, `outrigger_${dx}_${dz}`, 0.65, 0.18, dx, 0.32, 51.5 + dz, true);
  }

  for (const dx of [-6.0, -3.0]) {
    for (const dz of [-1.15, 1.15]) {
      wheel(scene, mats, CT, `caterW_${dx}_${dz}`, dx, 51.5 + dz, 0.95, 0.48, 0.35);
    }
  }

  // =========================================================================
  // 7. FUEL HYDRANT DISPENSER (FUEL-001)
  // =========================================================================
  const FV = new TransformNode('FUEL-001', scene);
  FV.parent = host;
  box(scene, mats.white, FV, 'fuelChassis', 4.8, 1.6, 2.0, 4.0, 1.1, 52.5, true);
  box(scene, mats.cockpitGlass, FV, 'fuelWindshield', 0.15, 0.75, 1.8, 6.45, 1.4, 52.5);

  cyl(scene, mats.darkMetal, FV, 'fuelReel', 0.75, 1.1, 2.5, 1.2, 52.5);
  const fuelMeter = box(scene, mats.darkMetal, FV, 'fuelMeter', 0.65, 0.55, 0.15, 1.8, 1.3, 51.4);
  fuelMeter.material = textPlate(scene, 'JET A-1  ● 42,000 L', { bg: '#0f172a', fg: '#38bdf8', font: 36 });

  for (const dx of [-1.2, 1.8]) {
    for (const dz of [-1.05, 1.05]) {
      wheel(scene, mats, FV, `fuelW_${dx}_${dz}`, 4.0 + dx, 52.5 + dz, 0.85, 0.42, 0.32);
    }
  }

  // =========================================================================
  // 8. SAFETY CONES & WHEEL CHOCKS
  // =========================================================================
  const coneMat = new PBRMaterial('safetyConeMat', scene);
  coneMat.albedoColor = new Color3(0.95, 0.45, 0.05);
  coneMat.emissiveColor = new Color3(0.4, 0.15, 0.02);

  const conePositions: [number, number][] = [
    [-13.5, 36], [13.5, 36],
    [-13.5, 54], [13.5, 54],
    [-1.5, 32], [1.5, 32],
    [0, 58],
    // Side stands B14 / C16 get their own safety perimeters (match ±62 spacing)
    [-75.5, 36], [-48.5, 36],
    [-75.5, 54], [-48.5, 54],
    [48.5, 36], [75.5, 36],
    [48.5, 54], [75.5, 54],
  ];

  conePositions.forEach(([x, z], i) => {
    const coneNode = new TransformNode(`safetyCone_${i}`, scene);
    coneNode.parent = host;
    box(scene, mats.darkMetal, coneNode, 'coneBase', 0.48, 0.04, 0.48, x, 0.02, z);
    const coneBody = MeshBuilder.CreateCylinder(`coneBody_${i}`, { height: 0.85, diameterTop: 0.08, diameterBottom: 0.38, tessellation: 16 }, scene);
    coneBody.parent = coneNode;
    coneBody.position.set(x, 0.44, z);
    coneBody.material = coneMat;
    const collar = MeshBuilder.CreateCylinder(`coneCollar_${i}`, { height: 0.22, diameterTop: 0.16, diameterBottom: 0.24, tessellation: 16 }, scene);
    collar.parent = coneNode;
    collar.position.set(x, 0.48, z);
    collar.material = mats.white;
  });

  const chockMat = new PBRMaterial('chockMat', scene);
  chockMat.albedoColor = new Color3(0.9, 0.8, 0.05);
  box(scene, chockMat, host, 'chockNoseFwd', 0.95, 0.18, 0.22, 12.2, 0.09, 45.45);
  box(scene, chockMat, host, 'chockNoseAft', 0.95, 0.18, 0.22, 12.2, 0.09, 44.55);

  // =========================================================================
  // 9. PARKED CARS IN PARKING P1 & CURBSIDE DROP-OFF
  // =========================================================================
  const landsideRoot = new TransformNode('landsideVehicles', scene);
  landsideRoot.parent = host;

  // Parked cars in Parking P1
  const parkingCars = [
    { x: -14, z: -58, color: new Color3(0.12, 0.18, 0.3), rotY: 0 },
    { x: -6, z: -58, color: new Color3(0.85, 0.15, 0.15), rotY: 0 },
    { x: 6, z: -58, color: new Color3(0.9, 0.92, 0.95), rotY: 0 },
    { x: 14, z: -58, color: new Color3(0.15, 0.15, 0.16), rotY: 0 },
    { x: -10, z: -64, color: new Color3(0.18, 0.45, 0.25), rotY: Math.PI },
    { x: 10, z: -64, color: new Color3(0.8, 0.6, 0.1), rotY: Math.PI },
  ];

  parkingCars.forEach((cfg, i) => {
    createCar(scene, mats, landsideRoot, `parkedCar_${i}`, cfg.color, cfg.x, 0, cfg.z, cfg.rotY);
  });

  // Parked Taxis & Sedans at Curbside Drop-off (z = -27.5)
  const curbCars = [
    { x: -22, color: new Color3(0.95, 0.8, 0.1), isTaxi: true },
    { x: -11, color: new Color3(0.12, 0.15, 0.2), isTaxi: false },
    { x: 11, color: new Color3(0.95, 0.8, 0.1), isTaxi: true },
    { x: 22, color: new Color3(0.92, 0.94, 0.98), isTaxi: false },
  ];

  curbCars.forEach((cfg, i) => {
    const c = createCar(scene, mats, landsideRoot, `curbCar_${i}`, cfg.color, cfg.x, 0, -27.5, Math.PI / 2);
    if (cfg.isTaxi) {
      const taxiSign = box(scene, mats.white, c, 'taxiSign', 0.85, 0.22, 0.35, 0, 1.8, 0);
      taxiSign.material = textPlate(scene, 'TAXI', { bg: '#fef08a', fg: '#000000', font: 72 });
    }
  });

  // =========================================================================
  // 10. ANIMATED VEHICLE ENTERING AIRPORT ROAD (Journey Start)
  // =========================================================================
  // Car moves along access road (X: -36 to 8, Z: -41), turns into Parking P1 lane (Z: -41 to -54), slows down and stops.
  const movingCar = createCar(scene, mats, landsideRoot, 'airportEnteringCar', new Color3(0.15, 0.35, 0.72), -35, 0, -41, Math.PI / 2);

  return {
    update(dt: number, t: number) {
      // Loop duration: 24 seconds for complete vehicle arrival journey
      const loopTime = t % 24;

      if (loopTime < 10) {
        // Leg 1: Driving along main entrance highway (moving east +X)
        const progress = loopTime / 10;
        const x = -35 + progress * 30; // -35 to -5
        movingCar.position.set(x, 0, -41);
        movingCar.rotation.y = Math.PI / 2;
      } else if (loopTime < 13) {
        // Leg 2: Turning right into Parking P1 entrance lane
        const progress = (loopTime - 10) / 3;
        const angle = Math.PI / 2 + progress * (Math.PI / 2); // PI/2 to PI (turning south)
        const x = -5 + Math.sin(progress * Math.PI * 0.5) * -3;
        const z = -41 - progress * 8; // -41 to -49
        movingCar.position.set(x, 0, z);
        movingCar.rotation.y = angle;
      } else if (loopTime < 18) {
        // Leg 3: Driving through parking lane to parking stall (moving south -Z)
        const progress = (loopTime - 13) / 5;
        const z = -49 - progress * 9; // -49 to -58
        movingCar.position.set(-8, 0, z);
        movingCar.rotation.y = Math.PI;
      } else {
        // Leg 4: Parked in stall (stopped)
        movingCar.position.set(-8, 0, -58);
        movingCar.rotation.y = Math.PI;
      }
    },
  };
}
