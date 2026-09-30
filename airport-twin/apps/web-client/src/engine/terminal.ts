import { Color3, Material, Mesh, MeshBuilder, Scene, PBRMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { Mats, fidsTexture, textPlate } from './materials';

export interface Built {
  groups: Map<string, TransformNode>;
  doors: { L: Mesh; R: Mesh; cx: number; cz: number }[];
  shadowCasters: Mesh[];
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

function sign(
  scene: Scene,
  parent: TransformNode,
  text: string,
  x: number,
  y: number,
  z: number,
  w = 4,
  h = 1,
  ry = 0,
  bg = '#0b2a4a',
  sub = '',
) {
  const s = MeshBuilder.CreatePlane(`sign_${text}_${x}`, { width: w, height: h }, scene);
  s.parent = parent;
  s.position.set(x, y, z);
  s.rotation.y = ry;
  s.material = textPlate(scene, text, { bg, sub, font: 52 });
  s.isPickable = false;
  return s;
}

/**
 * End-to-End Operational Airport Complex:
 * - Access Highway & Gantry Signs
 * - Parking Facility P1 & Pedestrian Crosswalks
 * - Landside Curbside Drop-off & Main Terminal Entrances
 * - Departure Hall: Check-in Islands, Self Bag Drop, Kiosks, Info Desk, FIDS-001
 * - Security Screening: X-Ray Converyors, Metal Detectors, Body Scanners
 * - Departure Concourse: Gates A01-A03, Biometric Turnstiles, Duty Free, Cafe, FIDS-002
 * - Telescoping Jet Bridge A12 connecting to Aircraft Door L2
 * - Arrivals Corridor, Passport / Immigration Control (PASSPORT-001)
 * - Baggage Reclaim Hall (CONV-001, CONV-002) with circulating carousels
 * - Customs Clearance Area (CUSTOMS-001) with Green/Red Channels
 * - Arrivals Welcome Hall & Pick-Up / Taxi Exit
 */
export function buildTerminal(scene: Scene, mats: Mats): Built {
  const groups = new Map<string, TransformNode>();
  const anchor = (id: string) => {
    const t = new TransformNode(id, scene);
    groups.set(id, t);
    return t;
  };
  const casters: Mesh[] = [];
  const doors: Built['doors'] = [];
  const T = anchor('TERMINAL-001');

  // =========================================================================
  // 1. FLOOR, ROOF, STRUCTURAL COLUMNS & SKYLIGHTS
  // =========================================================================
  const floor = MeshBuilder.CreateGround('floor', { width: 68, height: 46 }, scene);
  floor.parent = T;
  floor.position.set(0, 0, 0);
  floor.material = mats.floor;
  floor.checkCollisions = true;
  floor.isPickable = false;

  // Concourse carpet zone on airside (z = 4 to 20)
  const gateCarpetZone = MeshBuilder.CreateGround('gateCarpetZone', { width: 62, height: 16 }, scene);
  gateCarpetZone.parent = T;
  gateCarpetZone.position.set(0, 0.015, 12);
  gateCarpetZone.material = mats.concourseFloor;
  gateCarpetZone.isPickable = false;

  // Main Terminal Ceiling with recessed troffers
  const ceil = box(scene, mats.ceiling, T, 'ceil', 68, 0.4, 46, 0, 6.2, 0);
  casters.push(ceil);

  // Central Architectural Skylight Glazing Strip
  box(scene, mats.glass, T, 'skylightGlazing', 46, 0.15, 6, 0, 6.25, 0);
  for (let x = -20; x <= 20; x += 4) {
    box(scene, mats.darkMetal, T, `skyMull_${x}`, 0.25, 0.35, 6.2, x, 6.3, 0);
  }

  // Aerodynamic Overhanging Cantilevered Roof
  const mainRoof = box(scene, mats.roof, T, 'mainRoof', 72, 0.65, 50, 0, 6.6, 0);
  casters.push(mainRoof);

  // Space-Frame Structural Roof Trusses
  for (let z = -14; z <= 14; z += 7) {
    box(scene, mats.steel, T, `truss_${z}`, 66, 0.35, 0.35, 0, 5.85, z);
  }

  // Structural Columns (Double-Height Composite Columns)
  for (let x = -22; x <= 22; x += 11) {
    for (const z of [-10, 0, 10]) {
      const col = cyl(scene, mats.white, T, `col_${x}_${z}`, 6.0, 0.85, x, 3.0, z, true);
      casters.push(col);
      cyl(scene, mats.steel, T, `colBase_${x}_${z}`, 0.4, 0.95, x, 0.2, z);
      cyl(scene, mats.steel, T, `colCap_${x}_${z}`, 0.35, 1.2, x, 5.9, z);
    }
  }

  // Exterior Boundary Walls (East, West)
  box(scene, mats.wall, T, 'eastWall', 0.45, 6.0, 46, 34, 3.0, 0, true);
  box(scene, mats.wall, T, 'westWall', 0.45, 6.0, 46, -34, 3.0, 0, true);

  // =========================================================================
  // 2. SOUTH LANDSIDE FACADE & MAIN ENTRANCE PORTALS (z = -20)
  // =========================================================================
  const segs: [number, number][] = [[-26, 12], [-9, 12], [9, 12], [26, 12]];
  segs.forEach(([x, w], i) => {
    box(scene, mats.wall, T, `sWall_${i}`, w, 6.0, 0.45, x, 3.0, -20, true);
  });

  // Upper South Clerestory Glass Ribbon
  box(scene, mats.glass, T, 'sClerestoryGlass', 66, 1.8, 0.15, 0, 4.8, -19.75);
  for (let x = -30; x <= 30; x += 3) {
    box(scene, mats.darkMetal, T, `sMullion_${x}`, 0.15, 1.85, 0.25, x, 4.8, -19.75);
  }

  // 3 Grand Entrance Portals: Arrivals (x = -16), Main Entrance (x = 0), Departures (x = 16)
  const entranceSpecs: [number, string, string, string, string][] = [
    [-16, 'ARR-ENT', 'ARRIVALS', '#0369a1', 'BAGGAGE CLAIM & EXIT'],
    [0, 'MAIN-ENT', 'TERMINAL A', '#1e3a8a', 'WELCOME / BIENVENUE'],
    [16, 'DEP-ENT', 'DEPARTURES', '#15803d', 'CHECK-IN & GATES'],
  ];

  entranceSpecs.forEach(([x, id, label, color, sub]) => {
    const G = anchor(id);
    box(scene, mats.darkMetal, G, `portalTop_${x}`, 5.0, 0.7, 1.6, x, 5.2, -20);
    box(scene, mats.darkMetal, G, `portalL_${x}`, 0.45, 5.2, 1.6, x - 2.3, 2.6, -20, true);
    box(scene, mats.darkMetal, G, `portalR_${x}`, 0.45, 5.2, 1.6, x + 2.3, 2.6, -20, true);
    box(scene, mats.darkMetal, G, `sensor_${x}`, 1.2, 0.15, 0.25, x, 4.2, -20.8);

    const L = box(scene, mats.glass, G, `doorLeafL_${x}`, 1.6, 3.8, 0.14, x - 0.85, 1.9, -20);
    const R = box(scene, mats.glass, G, `doorLeafR_${x}`, 1.6, 3.8, 0.14, x + 0.85, 1.9, -20);
    doors.push({ L, R, cx: x, cz: -20 });

    box(scene, mats.white, L, `doorStripeL_${x}`, 1.5, 0.08, 0.16, x - 0.85, 1.5, -20);
    box(scene, mats.white, R, `doorStripeR_${x}`, 1.5, 0.08, 0.16, x + 0.85, 1.5, -20);

    sign(scene, G, label, x, 5.8, -20.85, 5.8, 1.1, Math.PI, color, sub);
  });

  // =========================================================================
  // 3. AIRPORT ACCESS ROAD, HIGHWAY GANTRY & PARKING P1 (z = -22 to -65)
  // =========================================================================
  const LSide = anchor('LANDSIDE');

  // Curbside Multi-Lane Drop-Off & Pick-Up Road (z = -27)
  const dropOffRoad = MeshBuilder.CreateGround('dropOffRoad', { width: 78, height: 12 }, scene);
  dropOffRoad.parent = LSide;
  dropOffRoad.position.set(0, 0.02, -27);
  dropOffRoad.material = mats.road;
  dropOffRoad.isPickable = false;

  // Curbside Sidewalk with Tactile Paving Edge
  box(scene, mats.floor, LSide, 'curbSidewalk', 78, 0.18, 4.2, 0, 0.09, -21.5, false);

  // Stainless Steel Security Bollards along curb
  for (let x = -36; x <= 36; x += 4) {
    cyl(scene, mats.steel, LSide, `bollard_${x}`, 0.95, 0.2, x, 0.48, -23.4, true);
  }

  // Grand Cantilevered Passenger Drop-Off Weather Canopy
  box(scene, mats.roof, LSide, 'canopyRoof', 72, 0.45, 7.5, 0, 5.2, -23.2);
  for (let x = -32; x <= 32; x += 8) {
    cyl(scene, mats.steel, LSide, `canopyCol_${x}`, 5.2, 0.42, x, 2.6, -26.5, true);
  }

  // Facade Skyline Signage
  sign(scene, LSide, '✈  INTERNATIONAL AIRPORT — TERMINAL A', 0, 7.2, -20.1, 28, 1.6, 0, '#0b2a4a');
  sign(scene, LSide, 'TAXI · BUS · PASSENGER DROP-OFF ➔', 16, 4.2, -20.6, 12, 0.9, Math.PI, '#065f46');

  // Multi-Lane Airport Access Highway (z = -35 to -48)
  const accessHighway = MeshBuilder.CreateGround('accessHighway', { width: 78, height: 14 }, scene);
  accessHighway.parent = LSide;
  accessHighway.position.set(0, 0.02, -41);
  accessHighway.material = mats.road;
  accessHighway.isPickable = false;

  // Overhead Highway Entrance Gantry Sign (x = 0, z = -47)
  const gantryNode = new TransformNode('highwayGantry', scene);
  gantryNode.parent = LSide;
  cyl(scene, mats.steel, gantryNode, 'gantryPoleL', 7.5, 0.45, -16, 3.75, -47, true);
  cyl(scene, mats.steel, gantryNode, 'gantryPoleR', 7.5, 0.45, 16, 3.75, -47, true);
  box(scene, mats.steel, gantryNode, 'gantryBeam', 32.5, 0.8, 0.8, 0, 7.2, -47);
  // 3 Gantry Directional Signs
  sign(scene, gantryNode, '✈ TERMINAL A / DEPARTURES', 8, 7.2, -47.45, 9.5, 1.3, Math.PI, '#15803d', 'ALL AIRLINES / DROP-OFF');
  sign(scene, gantryNode, 'PARKING P1 (SHORT & LONG STAY)', -2, 7.2, -47.45, 9.5, 1.3, Math.PI, '#1e3a8a', 'SPACE AVAILABLE: 428');
  sign(scene, gantryNode, 'ARRIVALS / PASSENGER PICK-UP', -12, 7.2, -47.45, 9.5, 1.3, Math.PI, '#0369a1', 'GROUND TRANSPORT / CAR RENTAL');

  // Airport Parking Facility P1 (z = -50 to -68)
  const P1 = anchor('PARKING-P1');
  const parkingLot = MeshBuilder.CreateGround('parkingP1Ground', { width: 78, height: 20 }, scene);
  parkingLot.parent = P1;
  parkingLot.position.set(0, 0.02, -59);
  parkingLot.material = mats.parkingAsphalt;
  parkingLot.isPickable = false;

  // Parking Facility Entrance Booth & Barrier Arm
  box(scene, mats.white, P1, 'pBooth', 2.2, 2.5, 2.2, -18, 1.25, -49, true);
  box(scene, mats.cockpitGlass, P1, 'pBoothGlass', 1.8, 1.1, 1.8, -18, 1.8, -49);
  const barrierArm = box(scene, mats.hiVisYellow, P1, 'pBarrierArm', 4.5, 0.15, 0.15, -15, 0.95, -49);
  barrierArm.rotation.z = -0.35; // Open barrier for entering vehicle
  sign(scene, P1, 'PARKING P1 ENTRANCE', -18, 3.1, -49, 4.2, 0.75, Math.PI, '#1e3a8a');

  // Automated Parking Pay Station Kiosks
  for (const px of [-10, 10]) {
    box(scene, mats.darkMetal, P1, `payStation_${px}`, 0.8, 1.8, 0.6, px, 0.9, -51, true);
    box(scene, mats.screen, P1, `payScreen_${px}`, 0.6, 0.5, 0.08, px, 1.4, -50.7);
    sign(scene, P1, 'PARKING PAY STATION', px, 2.2, -51, 2.5, 0.45, Math.PI, '#0284c7');
  }

  // Pedestrian Walkway Crossing from Parking P1 to Terminal Entrance
  const crosswalk = MeshBuilder.CreateGround('parkingCrosswalk', { width: 4.5, height: 28 }, scene);
  crosswalk.parent = LSide;
  crosswalk.position.set(0, 0.025, -35);
  const crossMat = new PBRMaterial('crosswalkMat', scene);
  crossMat.albedoColor = new Color3(0.95, 0.95, 0.95);
  crosswalk.material = crossMat;
  crosswalk.isPickable = false;

  // Street Lamps along roads & parking
  for (let x = -32; x <= 32; x += 16) {
    cyl(scene, mats.darkMetal, LSide, `lampPost_${x}`, 7.0, 0.28, x, 3.5, -34, true);
    box(scene, mats.darkMetal, LSide, `lampArm_${x}`, 0.25, 0.25, 2.8, x, 6.8, -33);
    const head = box(scene, mats.white, LSide, `lampHead_${x}`, 0.8, 0.22, 1.1, x, 6.7, -32);
    head.material = textPlate(scene, '▮', { bg: '#fef9c3', fg: '#fef9c3' });
  }

  // =========================================================================
  // 4. DEPARTURE HALL: CHECK-IN ISLANDS, KIOSKS, QUEUES & FIDS-001
  // =========================================================================
  const buildCheckInIsland = (id: string, cx: number) => {
    const G = anchor(id);
    box(scene, mats.counter, G, 'deskBase', 13.2, 1.05, 1.2, cx, 0.55, -6, true);
    box(scene, mats.white, G, 'deskTop', 13.6, 0.12, 1.45, cx, 1.12, -6, true);

    for (let i = 0; i < 6; i++) {
      const x = cx - 5.2 + i * 2.1;
      box(scene, mats.darkMetal, G, `divider_${i}`, 0.08, 0.55, 1.2, x + 1.05, 1.45, -6);
      cyl(scene, mats.steel, G, `scrPole_${i}`, 0.9, 0.06, x, 1.6, -6.3);
      box(scene, mats.screen, G, `screen_${i}`, 0.75, 0.45, 0.08, x, 2.1, -6.3);
      // Baggage Intake Weighing Conveyor Belt
      box(scene, mats.belt, G, `belt_${i}`, 1.5, 0.14, 2.4, x, 0.38, -8.2, true);
      box(scene, mats.screen, G, `scaleLcd_${i}`, 0.32, 0.18, 0.08, x + 0.65, 1.2, -6.0);
    }

    sign(scene, G, id === 'CHECKIN-001' ? 'CHECK-IN 01–06' : 'CHECK-IN 07–12', cx, 3.8, -6, 7.5, 0.9, 0, '#1d4ed8', 'ALL FLIGHTS / BAG DROP');
    casters.push(box(scene, mats.wall, G, 'islandBack', 13.2, 2.4, 0.35, cx, 1.2, -4.5, true));
    return G;
  };

  buildCheckInIsland('CHECKIN-001', -12);
  buildCheckInIsland('CHECKIN-002', 2);

  // Self-Service Check-In Kiosks
  const K = anchor('KIOSKS');
  for (let i = 0; i < 6; i++) {
    const x = -21 + i * 2.3;
    box(scene, mats.white, K, `kioskBody_${i}`, 0.75, 1.55, 0.55, x, 0.78, -14, true);
    const kScr = box(scene, mats.screen, K, `kioskScr_${i}`, 0.65, 0.55, 0.06, x, 1.48, -13.78);
    kScr.rotation.x = -0.32;
    box(scene, mats.darkMetal, K, `kioskSlot_${i}`, 0.4, 0.06, 0.15, x, 1.1, -13.72);
  }
  sign(scene, K, 'SELF CHECK-IN & BAG DROP', -15.2, 2.9, -14, 6.5, 0.75, 0, '#0e7490');

  // Queue Stanchions
  const Q = anchor('QUEUES');
  const buildQueueStanchions = (cx: number, z: number) => {
    for (let i = 0; i < 6; i++) {
      const x = cx - 5 + i * 2.0;
      cyl(scene, mats.chrome, Q, `stanchionPost_${cx}_${i}`, 1.0, 0.08, x, 0.5, z, true);
      cyl(scene, mats.chrome, Q, `stanchionBase_${cx}_${i}`, 0.06, 0.42, x, 0.03, z);
      if (i < 5) {
        box(scene, mats.counter, Q, `stanchionBelt_${cx}_${i}`, 1.95, 0.08, 0.03, x + 1.0, 0.88, z);
      }
    }
  };
  buildQueueStanchions(-12, -9.6);
  buildQueueStanchions(2, -9.6);

  // Information Desk
  const InfoNode = anchor('INFO-DESK');
  box(scene, mats.counter, InfoNode, 'infoBase', 4.2, 1.1, 1.4, 8, 0.55, -14, true);
  box(scene, mats.white, InfoNode, 'infoTop', 4.5, 0.12, 1.6, 8, 1.16, -14, true);
  sign(scene, InfoNode, 'INFORMATION', 8, 2.7, -14, 4.5, 0.8, 0, '#7c3aed', 'AIRPORT CUSTOMER SERVICE');

  // Suspended FIDS-001 (Departures)
  const F1 = anchor('FIDS-001');
  cyl(scene, mats.darkMetal, F1, 'fidsHangerL', 2.8, 0.12, -7.0, 4.8, -12, true);
  cyl(scene, mats.darkMetal, F1, 'fidsHangerR', 2.8, 0.12, -3.0, 4.8, -12, true);
  const fids1 = box(scene, mats.darkMetal, F1, 'fidsArray', 5.6, 2.4, 0.35, -5.0, 3.4, -12, true);
  fids1.material = fidsTexture(scene, 'DEPARTURES', [
    ['MS123', 'CAIRO / TERMINAL 3', '18:40', 'A12', 'BOARDING'],
    ['EK456', 'DUBAI / DXB', '19:15', 'A02', 'ON TIME'],
    ['BA789', 'LONDON HEATHROW', '20:05', 'A03', 'ON TIME'],
    ['SV321', 'JEDDAH / JED', '21:00', 'A04', 'ON TIME'],
    ['AF552', 'PARIS CDG', '21:45', 'A05', 'DELAYED'],
  ]);
  sign(scene, F1, 'DEPARTURES · CHECK-IN · SECURITY ➔', -1.5, 4.9, -12, 13, 0.8, 0, '#1e3a8a');

  // =========================================================================
  // 5. SECURITY SCREENING CHECKPOINT & ESCALATORS
  // =========================================================================
  const buildSecurityLane = (id: string, x: number) => {
    const G = anchor(id);
    box(scene, mats.steel, G, 'rollerTableIn', 1.2, 0.85, 5.5, x - 1.5, 0.42, 2.0, true);
    box(scene, mats.belt, G, 'beltSurfaceIn', 0.95, 0.08, 5.2, x - 1.5, 0.88, 2.0);
    box(scene, mats.steel, G, 'rollerTableOut', 1.2, 0.85, 5.5, x + 1.5, 0.42, 2.0, true);
    box(scene, mats.belt, G, 'beltSurfaceOut', 0.95, 0.08, 5.2, x + 1.5, 0.88, 2.0);

    box(scene, mats.darkMetal, G, 'xrayTunnel', 1.5, 1.65, 2.2, x, 0.82, 2.0, true);
    box(scene, mats.belt, G, 'xrayCurtains', 1.0, 0.75, 2.3, x, 0.78, 2.0);

    box(scene, mats.white, G, 'inspectorDesk', 1.1, 0.95, 1.1, x + 1.1, 0.48, 3.2);
    const scr1 = box(scene, mats.screen, G, 'inspectScr1', 0.75, 0.55, 0.08, x + 1.0, 1.95, 3.1);
    scr1.rotation.y = 0.45;

    for (let tIdx = 0; tIdx < 3; tIdx++) {
      box(scene, mats.bin, G, `trayStack_${tIdx}`, 0.65, 0.12, 0.45, x - 1.5, 0.95 + tIdx * 0.14, -0.2);
    }

    box(scene, mats.white, G, 'archL', 0.28, 2.35, 1.2, x - 0.62, 1.18, -0.6, true);
    box(scene, mats.white, G, 'archR', 0.28, 2.35, 1.2, x + 0.62, 1.18, -0.6, true);
    box(scene, mats.white, G, 'archT', 1.52, 0.28, 1.2, x, 2.45, -0.6, true);

    const ledGreen = box(scene, mats.white, G, 'archLedGreen', 0.08, 0.08, 1.22, x + 0.62, 2.1, -0.6);
    ledGreen.material = textPlate(scene, '●', { bg: '#16a34a', fg: '#16a34a' });

    sign(scene, G, 'SECURITY CHECKPOINT', x, 3.6, 0, 3.8, 0.75, 0, '#b91c1c', 'PASSPORT & BOARDING PASS REQUIRED');
    return G;
  };

  buildSecurityLane('SECURITY-001', -4);
  buildSecurityLane('SECURITY-002', 2);

  const ES = anchor('ESCALATOR-001');
  const esc = box(scene, mats.steel, ES, 'escBase', 1.6, 0.45, 7.5, 14, 1.2, -2, true);
  esc.rotation.x = 0.32;
  for (let i = 0; i < 9; i++) {
    box(scene, mats.darkMetal, ES, `escStep_${i}`, 1.35, 0.18, 0.75, 14, 0.5 + i * 0.34, -5.2 + i * 0.82, true);
  }
  box(scene, mats.glass, ES, 'escRailL', 0.08, 1.1, 7.8, 13.2, 1.9, -2);
  box(scene, mats.glass, ES, 'escRailR', 0.08, 1.1, 7.8, 14.8, 1.9, -2);
  sign(scene, ES, 'ESCALATOR ➔ LEVEL 2', 14, 3.6, -2, 3.6, 0.7, 0, '#0284c7');

  const EL = anchor('ELEVATOR-001');
  box(scene, mats.glass, EL, 'elevatorShaft', 2.6, 5.2, 2.6, 17.5, 2.6, -2, true);
  box(scene, mats.steel, EL, 'elevatorCab', 2.0, 2.6, 2.0, 17.5, 1.3, -2);
  sign(scene, EL, 'LIFT / ELEVATOR', 17.5, 5.2, -2, 2.6, 0.7, 0, '#0284c7');

  // Duty Free & Cafe Lounges
  const SH = anchor('SHOPS');
  const buildShop = (x: number, z: number, name: string, color: string, sub: string) => {
    box(scene, mats.darkMetal, SH, `shopFront_${name}`, 6.8, 3.6, 0.45, x, 1.8, z, true);
    sign(scene, SH, name, x, 3.9, z + 0.35, 5.8, 0.9, 0, color, sub);
    box(scene, mats.glass, SH, `shopWindow_${name}`, 6.2, 2.2, 0.15, x, 1.6, z + 0.15);
  };
  buildShop(-28, -2, 'DUTY FREE', '#7c3aed', 'WORLD CLASS LUXURY BRANDS');
  buildShop(-28, 6, 'CAFÉ & LOUNGE', '#b45309', 'FRESH COFFEE & PASTRIES');

  // =========================================================================
  // 6. AIRSIDE CONCOURSE & BOARDING GATES (GATE-A01, GATE-A02, GATE-A03, FIDS-002)
  // =========================================================================
  const buildGate = (id: string, x: number, dest: string, time: string) => {
    const G = anchor(id);
    box(scene, mats.counter, G, 'gatePodium', 2.8, 1.15, 1.0, x, 0.58, 15.5, true);
    box(scene, mats.white, G, 'gatePodiumTop', 2.9, 0.1, 1.15, x, 1.2, 15.5, true);

    const gs = box(scene, mats.screen, G, 'gateScreen', 1.8, 0.75, 0.1, x, 2.35, 15.7);
    gs.material = textPlate(scene, `${id.replace('-', ' ')} · ${dest}`, {
      bg: '#0b2a4a',
      fg: '#38bdf8',
      font: 48,
      sub: `DEPARTURE ${time} · BOARDING`,
    });

    sign(scene, G, `${id.replace('-', ' ')} ➔ ${dest}`, x, 3.6, 15.5, 6.2, 0.9, 0, '#1d4ed8');

    // Airport Concourse Beam Seating (2 rows of 5 ergonomic seats per gate)
    for (let r = 0; r < 2; r++) {
      for (let s = 0; s < 5; s++) {
        const sx = x - 3.2 + s * 1.6;
        const sz = 12.2 + r * 1.5;
        box(scene, mats.steel, G, `seatBeam_${r}_${s}`, 1.35, 0.09, 0.12, sx, 0.44, sz);
        cyl(scene, mats.steel, G, `seatLeg_${r}_${s}`, 0.44, 0.08, sx, 0.22, sz);
        box(scene, mats.seatFabric, G, `seatBase_${r}_${s}`, 1.2, 0.12, 0.52, sx, 0.5, sz, true);
        box(scene, mats.seatFabric, G, `seatBack_${r}_${s}`, 1.2, 0.52, 0.12, sx, 0.8, sz + 0.26);
      }
    }
    return G;
  };

  buildGate('GATE-A01', -14, 'CAIRO', '18:40');
  buildGate('GATE-A02', -8, 'DUBAI', '19:15');
  buildGate('GATE-A03', -2, 'LONDON', '20:05');

  const F2 = anchor('FIDS-002');
  const fids2 = box(scene, mats.darkMetal, F2, 'fidsAirsideBox', 5.6, 2.4, 0.35, -8, 3.6, 8, true);
  fids2.material = fidsTexture(scene, 'GATES STATUS', [
    ['MS123', 'CAIRO / CAI', '18:40', 'A12', 'BOARDING'],
    ['EK456', 'DUBAI / DXB', '19:15', 'A02', 'FINAL CALL'],
    ['BA789', 'LONDON / LHR', '20:05', 'A03', 'ON TIME'],
  ]);
  sign(scene, F2, 'BOARDING GATES A01 – A03 ➔', -8, 5.2, 8, 7.2, 0.8, 0, '#1e3a8a');

  // Panoramic Glass Curtain Wall on North Airside (z = 20)
  const N = anchor('FACADE-N');
  for (let x = -32; x <= 32; x += 2.5) {
    if (x > -9.5 && x < -6.5) continue; // Keep Jet Bridge doorway clear
    box(scene, mats.glass, N, `airsideGlass_${x}`, 2.35, 5.4, 0.15, x, 2.7, 20);
    box(scene, mats.darkMetal, N, `airsideMullion_${x}`, 0.22, 5.8, 0.35, x - 1.25, 2.9, 20, true);
  }
  box(scene, mats.darkMetal, N, 'airsideBeamTop', 68, 0.7, 0.6, 0, 5.8, 20, true);
  box(scene, mats.darkMetal, N, 'airsideSillBottom', 68, 0.5, 0.6, 0, 0.25, 20, false);

  // =========================================================================
  // 7. TELESCOPING JET BRIDGE A12 (Stand A12 Connector)
  // =========================================================================
  const J = anchor('JETBRIDGE-001');
  cyl(scene, mats.steel, J, 'rotundaColumn', 4.5, 1.6, -8.0, 2.25, 20.8, true);

  box(scene, mats.white, J, 'walkwayWallW', 0.28, 4.0, 21.0, -9.4, 2.1, 30.5, true);
  box(scene, mats.white, J, 'walkwayWallE', 0.28, 4.0, 21.0, -6.6, 2.1, 30.5, true);
  box(scene, mats.roof, J, 'walkwayRoof', 3.1, 0.32, 21.5, -8.0, 4.25, 30.5);

  for (let i = 0; i < 5; i++) {
    box(scene, mats.darkMetal, J, `bellowsRib_${i}`, 3.25, 0.35, 0.35, -8.0, 4.1, 23.5 + i * 4.2);
  }

  // Corridor windows sit proud of the inner wall face (were buried inside the
  // wall volume → invisible + edge shimmer). Inner face is at x=-9.26.
  for (let z = 24; z <= 38; z += 3.5) {
    box(scene, mats.glass, J, `bridgeWin_${z}`, 0.12, 1.4, 2.2, -9.2, 2.4, z);
  }

  const bridgeRamp = box(scene, mats.floor, J, 'bridgeRampFloor', 2.35, 0.16, 22.0, -8.0, 0.62, 31.0, true);
  bridgeRamp.rotation.x = 0.052;

  box(scene, mats.darkMetal, J, 'dockingCabRoof', 3.8, 0.35, 3.2, -8.0, 3.95, 41.5, true);
  box(scene, mats.darkMetal, J, 'dockingCabWallL', 0.55, 2.8, 3.2, -9.7, 2.5, 41.5, true);
  box(scene, mats.darkMetal, J, 'dockingCabWallR', 0.55, 2.8, 3.2, -6.3, 2.5, 41.5, true);
  box(scene, mats.belt, J, 'rubberSealingBumper', 3.6, 2.6, 0.45, -8.0, 2.5, 43.1);

  cyl(scene, mats.darkMetal, J, 'driveWheelL', 1.8, 0.55, -9.3, 0.9, 34.0, true);
  cyl(scene, mats.darkMetal, J, 'driveWheelR', 1.8, 0.55, -6.7, 0.9, 34.0, true);
  box(scene, mats.steel, J, 'bogieAxle', 3.2, 0.35, 0.35, -8.0, 0.9, 34.0);

  sign(scene, J, 'GATE A12', -8.0, 4.65, 30.5, 2.6, 0.8, Math.PI / 2, '#1e3a8a');

  // Gate A12 Sliding Doors
  const gateDoorL = box(scene, mats.glass, N, 'gateDoorL', 1.2, 3.6, 0.14, -8.6, 1.8, 20);
  const gateDoorR = box(scene, mats.glass, N, 'gateDoorR', 1.2, 3.6, 0.14, -7.4, 1.8, 20);
  doors.push({ L: gateDoorL, R: gateDoorR, cx: -8, cz: 20 });

  // =========================================================================
  // 8. ARRIVALS JOURNEY: PASSPORT / IMMIGRATION CONTROL (PASSPORT-001)
  // =========================================================================
  const Pass = anchor('PASSPORT-001');
  // Immigration Officer Control Booths (x = 24 to 28, z = 12 to 18)
  for (let bIdx = 0; bIdx < 3; bIdx++) {
    const bz = 13 + bIdx * 2.8;
    // Booth desk & privacy partition
    box(scene, mats.darkMetal, Pass, `passBooth_${bIdx}`, 3.2, 1.2, 1.8, 26, 0.6, bz, true);
    box(scene, mats.white, Pass, `passTop_${bIdx}`, 3.4, 0.1, 2.0, 26, 1.25, bz, true);
    box(scene, mats.glass, Pass, `passGlass_${bIdx}`, 3.2, 1.2, 0.1, 26, 1.85, bz - 0.9);
    // Officer computer monitor & passport reader
    box(scene, mats.screen, Pass, `passScr_${bIdx}`, 0.7, 0.45, 0.08, 26.2, 1.6, bz + 0.2);
  }

  // E-Passport Automated Biometric Turnstiles
  for (let eIdx = 0; eIdx < 2; eIdx++) {
    const ez = 5.5 + eIdx * 2.2;
    box(scene, mats.steel, Pass, `eGatePostL_${eIdx}`, 0.22, 1.2, 1.4, 24, 0.6, ez, true);
    box(scene, mats.steel, Pass, `eGatePostR_${eIdx}`, 0.22, 1.2, 1.4, 25.4, 0.6, ez, true);
    box(scene, mats.glass, Pass, `eGateFlap_${eIdx}`, 1.1, 0.8, 0.08, 24.7, 0.6, ez);
  }

  sign(scene, Pass, 'PASSPORT CONTROL / IMMIGRATION', 25, 4.2, 18, 9.5, 1.0, -Math.PI / 2, '#0f172a', 'ALL PASSPORTS & E-GATES');
  sign(scene, Pass, 'CITIZENS & RESIDENTS ➔', 25, 3.0, 16.5, 4.5, 0.65, -Math.PI / 2, '#15803d');
  sign(scene, Pass, 'ALL OTHER PASSPORTS ➔', 25, 3.0, 13.5, 4.5, 0.65, -Math.PI / 2, '#0369a1');

  // =========================================================================
  // 9. BAGGAGE CLAIM HALL (CONV-001, CONV-002)
  // =========================================================================
  const buildBaggageCarousel = (id: string, z: number) => {
    const G = anchor(id);
    // Continuous Stainless Steel Racetrack Conveyor Bed
    box(scene, mats.steel, G, 'carouselBed', 8.5, 0.48, 2.6, 12.5, 0.48, z, true);
    box(scene, mats.belt, G, 'slattedBelt', 8.2, 0.12, 2.3, 12.5, 0.76, z);

    // Wall Luggage Discharge Stainless Chute with Rubber Safety Flaps
    box(scene, mats.steel, G, 'dischargeHood', 2.8, 2.5, 2.8, 17.2, 1.25, z, true);
    box(scene, mats.belt, G, 'rubberFlaps', 0.18, 1.3, 1.8, 15.6, 1.0, z);

    sign(scene, G, id === 'CONV-001' ? 'BAGGAGE CAROUSEL 1' : 'BAGGAGE CAROUSEL 2', 12.5, 3.2, z, 6.2, 0.85, 0, '#15803d', 'FLIGHT MS123 · CAIRO');
    return G;
  };

  buildBaggageCarousel('CONV-001', -8.2);
  buildBaggageCarousel('CONV-002', -14.2);

  // =========================================================================
  // 10. CUSTOMS INSPECTION AREA (CUSTOMS-001)
  // =========================================================================
  const Cust = anchor('CUSTOMS-001');
  // Green Channel (Nothing to Declare) & Red Channel (Goods to Declare) Portals
  box(scene, mats.customsGreen, Cust, 'greenPortal', 3.8, 3.4, 0.35, 18, 1.7, -17.5, true);
  box(scene, mats.customsRed, Cust, 'redPortal', 3.8, 3.4, 0.35, 23, 1.7, -17.5, true);

  sign(scene, Cust, 'NOTHING TO DECLARE', 18, 3.1, -17.2, 3.6, 0.75, 0, '#15803d', 'GREEN CHANNEL ➔');
  sign(scene, Cust, 'GOODS TO DECLARE', 23, 3.1, -17.2, 3.6, 0.75, 0, '#b91c1c', 'RED CHANNEL ➔');

  // Customs Officer Inspection Bench
  box(scene, mats.steel, Cust, 'customsBench', 4.2, 0.95, 1.2, 23, 0.48, -15.5, true);
  box(scene, mats.darkMetal, Cust, 'customsDesk', 2.2, 1.1, 1.1, 18, 0.55, -15.5, true);

  // Arrivals Greeting Hall & Ground Transport Exits
  sign(scene, T, '➔ ARRIVALS EXIT · TAXI · PARKING P1', 20, 4.2, -19.2, 7.8, 0.95, 0, '#1e3a8a');
  sign(scene, T, 'CAR RENTAL & HOTEL SHUTTLES ➔', 28, 3.0, -15, 6.2, 0.75, -Math.PI / 2, '#0e7490');

  // CCTV Surveillance Cameras — realistic dark-glass lens (NOT a chrome mirror ball)
  // with a surface-mounted status LED (NOT a half-buried floating hemisphere).
  const buildCCTV = (id: string, x: number, y: number, z: number, ry = 0) => {
    const G = anchor(id);
    box(scene, mats.darkMetal, G, 'cctvArm', 0.12, 0.12, 0.9, x, y + 0.32, z, false, ry);
    box(scene, mats.white, G, 'cctvHousing', 0.32, 0.32, 0.75, x, y, z + 0.25, false, ry);
    // Lens bezel + forward-facing glass element, flush with the housing front
    const bezel = cyl(scene, mats.darkMetal, G, 'cctvBezel', 0.06, 0.24, x, y, z + 0.64);
    bezel.rotation.x = Math.PI / 2;
    const lensMat = new PBRMaterial(`lensMat_${id}`, scene);
    lensMat.albedoColor = new Color3(0.03, 0.05, 0.09);
    lensMat.metallic = 0.25;
    lensMat.roughness = 0.12;
    lensMat.emissiveColor = new Color3(0.02, 0.05, 0.1);
    const lens = cyl(scene, lensMat, G, 'cctvLens', 0.02, 0.18, x, y, z + 0.65);
    lens.rotation.x = Math.PI / 2; // recessed 0.01 behind the bezel rim — no coplanar faces

    // Status LED on a tiny surface bracket under the housing — fully outside it
    box(scene, mats.darkMetal, G, `ledBracket_${id}`, 0.1, 0.06, 0.1, x + 0.19, y - 0.19, z + 0.25);
    const led = MeshBuilder.CreateSphere(`led_${id}`, { diameter: 0.06 }, scene);
    led.parent = G;
    led.position.set(x + 0.19, y - 0.14, z + 0.25);
    const lm = new PBRMaterial(`ledm_${id}`, scene);
    lm.albedoColor = new Color3(1, 0, 0);
    lm.emissiveColor = new Color3(1, 0.1, 0.1);
    led.material = lm;
  };

  buildCCTV('CAM-001', -20, 3.6, -18);
  buildCCTV('CAM-002', -8, 3.6, 12, Math.PI);

  const C21 = anchor('CAM-021');
  cyl(scene, mats.steel, C21, 'apronMastPole', 14.0, 0.45, 8.0, 7.0, 25.0, true);
  box(scene, mats.darkMetal, C21, 'floodHeader', 3.6, 0.45, 0.8, 8.0, 13.8, 25.0);
  for (let fIdx = 0; fIdx < 4; fIdx++) {
    const floodFixture = box(scene, mats.white, C21, `floodFix_${fIdx}`, 0.75, 0.65, 0.35, 6.6 + fIdx * 0.95, 13.7, 25.3);
    floodFixture.material = textPlate(scene, '☀', { bg: '#fef08a', fg: '#fef08a', font: 72 });
  }
  box(scene, mats.white, C21, 'apronCamHousing', 0.35, 0.35, 0.9, 8.0, 7.5, 25.4);

  return { groups, doors, shadowCasters: casters };
}
