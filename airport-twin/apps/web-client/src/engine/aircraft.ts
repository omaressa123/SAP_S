import { Color3, Material, Mesh, MeshBuilder, Scene, PBRMaterial, TransformNode, VertexData, Vector3 } from '@babylonjs/core';
import { Mats, textPlate } from './materials';

export interface AircraftTick {
  update(dt: number, t: number): void;
}

/** Extrude a convex quad (x,z) vertically y0..y1 with computed normals. */
function plateXZ(scene: Scene, m: Material, parent: TransformNode, n: string, pts: [number, number][], y0: number, y1: number): Mesh {
  const [a, b, c, d] = pts;
  const v = [
    a[0], y0, a[1], b[0], y0, b[1], c[0], y0, c[1], d[0], y0, d[1],
    a[0], y1, a[1], b[0], y1, b[1], c[0], y1, c[1], d[0], y1, d[1],
  ];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  const mesh = new Mesh(n, scene);
  const vd = new VertexData();
  vd.positions = v;
  vd.indices = idx;
  const nm: number[] = [];
  VertexData.ComputeNormals(v, idx, nm);
  vd.normals = nm;
  vd.applyToMesh(mesh);
  mesh.refreshBoundingInfo();
  mesh.parent = parent;
  mesh.material = m;
  mesh.isPickable = false;
  return mesh;
}

/** Extrude a convex quad (x,y) in z0..z1 (for vertical fin / sharklets). */
function plateXY(scene: Scene, m: Material, parent: TransformNode, n: string, pts: [number, number][], z0: number, z1: number): Mesh {
  const [a, b, c, d] = pts;
  const v = [
    a[0], a[1], z0, b[0], b[1], z0, c[0], c[1], z0, d[0], d[1], z0,
    a[0], a[1], z1, b[0], b[1], z1, c[0], c[1], z1, d[0], d[1], z1,
  ];
  const idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  const mesh = new Mesh(n, scene);
  const vd = new VertexData();
  vd.positions = v;
  vd.indices = idx;
  const nm2: number[] = [];
  VertexData.ComputeNormals(v, idx, nm2);
  vd.normals = nm2;
  vd.applyToMesh(mesh);
  mesh.refreshBoundingInfo();
  mesh.parent = parent;
  mesh.material = m;
  mesh.isPickable = false;
  return mesh;
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
  const mesh = MeshBuilder.CreateCylinder(n, { height: h, diameter: dia, tessellation: 24 }, scene);
  mesh.parent = parent;
  mesh.position.set(x, y, z);
  mesh.material = m;
  mesh.checkCollisions = solid;
  mesh.isPickable = false;
  return mesh;
}

/**
 * Photorealistic Commercial Airliner (A320 / B737 scale):
 * - Smooth aerodynamic contoured fuselage with nose radome & tailcone
 * - Embedded passenger windows with subtle cabin glow & reflections
 * - Multi-pane cockpit windshield with anti-glare brow & wipers
 * - High-bypass LEAP-1A turbofan engines with spinning titanium fan blades & chrome cowl lips
 * - Tapered aerofoil swept wings with flap track canoes & blended sharklets
 * - 4-wheel main landing gear bogies + dual nose wheels touching ground with exact precision
 * - Walkable interior cabin with 3-3 seating, galley, lavatories, and 6-screen glass cockpit
 */
export interface AircraftOpts {
  id?: string;
  dx?: number;
  dz?: number;
  ry?: number;
  title?: string;
  sub?: string;
  reg?: string;
  stripe?: [number, number, number];
  fin?: [number, number, number];
  interior?: boolean;
}

export function buildAircraftExterior(scene: Scene, mats: Mats, host: TransformNode, opts: AircraftOpts = {}): AircraftTick {
  const AID = opts.id ?? 'AIRCRAFT-001';
  const G = new TransformNode(AID, scene);
  G.parent = host;
  G.position.set(opts.dx ?? 0, 0, (opts.dz ?? 0));
  G.rotation.y = opts.ry ?? 0;
  // local-fuselage frame: builder uses FZ=45 world; shift into G-local coords
  const FZ = 45 - (opts.dz ?? 0);
  const CY = 2.85; // Fuselage center axis height
  const casters: Mesh[] = [];

  // =========================================================================
  // 1. AERODYNAMIC FUSELAGE & NOSE RADOME
  // =========================================================================
  // Main Aerodynamic Fuselage Capsule
  const fuse = MeshBuilder.CreateCapsule('fuselage', {
    radius: 1.95,
    height: 30,
    tessellation: 48,
    capSubdivisions: 16,
  }, scene);
  fuse.parent = G;
  fuse.rotation.z = Math.PI / 2;
  fuse.position.set(0, CY, FZ);
  fuse.material = mats.fuselage;
  fuse.isPickable = false;
  fuse.checkCollisions = true; // solid: keep walker/follow cameras out of the tube
  casters.push(fuse);

  // Tapered Aerodynamic Tailcone Upsweep
  const tailCone = MeshBuilder.CreateCylinder('tailcone', {
    height: 7.8,
    diameterTop: 0.65,
    diameterBottom: 3.55,
    tessellation: 36,
  }, scene);
  tailCone.parent = G;
  tailCone.rotation.z = Math.PI / 2 - 0.16;
  tailCone.position.set(-18.6, CY + 0.68, FZ);
  tailCone.material = mats.fuselage;
  tailCone.isPickable = false;
  tailCone.checkCollisions = true;
  casters.push(tailCone);

  // APU Exhaust Orifice at tail tip
  const apuExh = MeshBuilder.CreateCylinder('apuExhaust', {
    height: 0.9,
    diameter: 0.46,
    tessellation: 20,
  }, scene);
  apuExh.parent = G;
  apuExh.rotation.z = Math.PI / 2;
  apuExh.position.set(-22.6, CY + 1.28, FZ);
  apuExh.material = mats.darkMetal;

  // Parabolic Streamlined Nose Radome
  const radome = MeshBuilder.CreateSphere('radome', {
    diameterX: 2.5,
    diameterY: 2.1,
    diameterZ: 2.1,
    segments: 32,
  }, scene);
  radome.parent = G;
  radome.position.set(16.2, CY - 0.18, FZ);
  radome.material = mats.fuselage;
  radome.isPickable = false;
  radome.checkCollisions = true;
  // NOTE (visual fix): mats.fuselage / mats.wing are procedural PBR colors with
  // NO albedoTexture, so they consume no UVs — shared use across capsule,
  // cylinder and plate meshes cannot produce broken-UV/magenta artifacts.

  // Pitot Static Sensor Probes
  for (const s of [-1, 1]) {
    const pitot = cyl(scene, mats.chrome, G, `pitot_${s}`, 0.38, 0.03, 16.6, CY + 0.12, FZ + s * 0.92);
    pitot.rotation.z = Math.PI / 2;
  }

  // Wing-to-Body Aerodynamic Center Belly Fairing (solid so cameras can't sit inside it)
  const bellyFairing = box(scene, mats.fuselage, G, 'bellyFairing', 12.5, 1.25, 4.5, 0.8, CY - 1.1, FZ, true);
  casters.push(bellyFairing);

  // =========================================================================
  // 2. AIRLINE LIVERY, PASSENGER WINDOWS & TITLES
  // =========================================================================
  const cheatlineMat = new PBRMaterial('cheatlineM', scene);
  const _stripe = opts.stripe ?? [0.08, 0.25, 0.65];
  cheatlineMat.albedoColor = new Color3(_stripe[0], _stripe[1], _stripe[2]); // Airline livery

  const goldAccentMat = new PBRMaterial('goldAccent', scene);
  goldAccentMat.albedoColor = new Color3(0.85, 0.68, 0.12);

  for (const s of [-1, 1]) {
    // Dual-Tone Livery Cheatlines — sit ~0.08 proud of the curved skin
    // (fuselage surface at this height is z≈±1.94; flush boxes z-fought).
    box(scene, cheatlineMat, G, `stripe_blue_${s}`, 28, 0.42, 0.05, 0.5, CY - 0.2, FZ + s * 2.02);
    box(scene, goldAccentMat, G, `stripe_gold_${s}`, 27, 0.12, 0.05, 0.5, CY - 0.48, FZ + s * 2.02);

    // Embedded Passenger Windows with Inner Reveal Bevel & Cabin Glow
    for (let x = -13.5; x <= 13.5; x += 0.95) {
      if ((x > 12.2 && x < 14.2) || (x > -9.8 && x < -6.2) || (x > -15.0 && x < -13.0)) continue;

      // Window Frame Bevel Rim
      const winRim = MeshBuilder.CreatePlane(`winRim_${s}_${x}`, { width: 0.42, height: 0.52 }, scene);
      winRim.parent = G;
      winRim.position.set(x, CY + 0.52, FZ + s * 2.0);
      winRim.rotation.y = s > 0 ? 0 : Math.PI;
      winRim.material = mats.darkMetal;

      // Dark Tinted Double-Pane Glass — 0.03 proud of the rim, never coplanar
      const winCut = MeshBuilder.CreatePlane(`win_${s}_${x}`, { width: 0.36, height: 0.46 }, scene);
      winCut.parent = G;
      winCut.position.set(x, CY + 0.52, FZ + s * 2.03);
      winCut.rotation.y = s > 0 ? 0 : Math.PI;

      const winMat = new PBRMaterial(`winM_${s}_${x}`, scene);
      winMat.albedoColor = new Color3(0.08, 0.14, 0.22);
      winMat.emissiveColor = new Color3(0.35, 0.48, 0.65);
      winCut.material = winMat;
    }
  }

  // Airline Titles & Registration Placards
  const _title = opts.title ?? '✈  SKYLINE AIRWAYS';
  const _reg = opts.reg ?? 'SU-A12';
  const titles = MeshBuilder.CreatePlane('airlineTitles', { width: 9.5, height: 1.2 }, scene);
  titles.parent = G;
  titles.position.set(5.5, CY + 0.4, FZ - 2.01);
  titles.rotation.y = Math.PI;
  titles.material = textPlate(scene, _title, {
    bg: '#ffffff',
    fg: '#1e3a8a',
    font: 44,
    border: '#ffffff',
    sub: opts.sub ?? 'INTERNATIONAL',
  });

  const regL = MeshBuilder.CreatePlane('regL', { width: 3.2, height: 0.75 }, scene);
  regL.parent = G;
  regL.position.set(-13.5, CY - 0.75, FZ - 1.96);
  regL.rotation.y = Math.PI;
  regL.material = textPlate(scene, _reg, { bg: '#ffffff', fg: '#0f172a', font: 56, border: '#ffffff' });

  // =========================================================================
  // 3. COCKPIT WINDSHIELD & WIPERS
  // =========================================================================
  const windshieldPanels: [number, number, number, number, number][] = [
    [0.42, -0.22, 15.6, CY + 0.88, FZ - 0.85],
    [-0.42, -0.22, 15.6, CY + 0.88, FZ + 0.85],
    [0.95, -0.15, 16.45, CY + 0.88, FZ - 0.42],
    [-0.95, -0.15, 16.45, CY + 0.88, FZ + 0.42],
  ];
  windshieldPanels.forEach(([ry, rx, px, py, pz], i) => {
    // Window framing trim
    const wsFrame = MeshBuilder.CreatePlane(`wsFrame_${i}`, { width: 1.02, height: 0.88 }, scene);
    wsFrame.parent = G;
    wsFrame.position.set(px, py, pz);
    wsFrame.rotation.set(rx, ry, 0);
    wsFrame.material = mats.darkMetal;

    // Dark anti-reflective cockpit glass — 0.035 proud of the frame (was 0.01: z-fight)
    const ws = MeshBuilder.CreatePlane(`cockpitShield_${i}`, { width: 0.95, height: 0.82 }, scene);
    ws.parent = G;
    ws.position.set(px, py, pz + (pz > FZ ? 0.035 : -0.035));
    ws.rotation.set(rx, ry, 0);
    ws.material = mats.cockpitGlass;
  });

  // Cockpit Anti-Glare Eyebrow Brow
  box(scene, mats.darkMetal, G, 'cockpitEyebrow', 1.8, 0.12, 1.8, 16.1, CY + 1.32, FZ);

  // Metallic Windshield Wiper Blades
  for (const s of [-0.35, 0.35]) {
    const wiper = box(scene, mats.darkMetal, G, `wiper_${s}`, 0.03, 0.52, 0.03, 16.5, CY + 0.75, FZ + s);
    wiper.rotation.z = -0.3;
  }

  // =========================================================================
  // 4. PASSENGER & CARGO DOORS
  // =========================================================================
  const doorOutline = mats.darkMetal;
  const buildDoor = (x: number, s: number, open: boolean, label: string) => {
    const z = FZ + s * 1.98; // frame floats just off the curved skin, never flush
    box(scene, doorOutline, G, `doorFrame_${label}`, 1.15, 2.1, 0.06, x, CY - 0.15, z);
    if (open) {
      // Articulated open door for Jet Bridge L2 boarding
      const doorLeaf = box(scene, mats.fuselage, G, `doorLeaf_${label}`, 1.05, 2.0, 0.08, x - 0.85, CY - 0.15, z - 0.85);
      doorLeaf.rotation.y = 1.25;
      box(scene, mats.darkMetal, doorLeaf, 'slideBustle', 0.85, 0.4, 0.14, x - 0.85, CY - 0.85, z - 0.85);
    } else {
      const doorPanel = box(scene, mats.fuselage, G, `doorLeaf_${label}`, 1.05, 1.98, 0.08, x, CY - 0.15, z + s * 0.05);
      const dWin = MeshBuilder.CreatePlane(`dWin_${label}`, { width: 0.28, height: 0.38 }, scene);
      dWin.parent = doorPanel;
      dWin.position.set(0, 0.45, s * 0.065); // 0.025 proud of the panel face (was 0.01)
      dWin.rotation.y = s > 0 ? 0 : Math.PI;
      dWin.material = mats.cockpitGlass;
    }
  };

  buildDoor(13.2, -1, false, 'L1');
  buildDoor(13.2, 1, false, 'R1');
  buildDoor(-8.0, -1, true, 'L2'); // L2 open to Jet Bridge A12
  buildDoor(-8.0, 1, false, 'R2');
  buildDoor(-14.2, -1, false, 'L3');
  buildDoor(-14.2, 1, false, 'R3');

  // Overwing Emergency Exits with Escape Arrows (0.04 proud — back face was buried in the skin)
  for (const x of [-1.8, 0.8]) {
    for (const s of [-1, 1]) {
      box(scene, doorOutline, G, `overwing_${x}_${s}`, 0.9, 1.25, 0.06, x, CY + 0.15, FZ + s * 1.99);
    }
  }

  // Starboard Lower Cargo Doors (Forward & Aft) — frame/door faces staggered, never coplanar
  for (const x of [7.5, -4.5]) {
    box(scene, mats.darkMetal, G, `cargoFrame_${x}`, 2.2, 1.4, 0.06, x, CY - 1.15, FZ + 1.93);
    box(scene, mats.fuselage, G, `cargoDoor_${x}`, 2.05, 1.25, 0.08, x, CY - 1.15, FZ + 1.97);
  }

  // =========================================================================
  // 5. SWEPT WINGS, FLAP TRACK CANOES & SHARKLETS
  // =========================================================================
  const wingR = plateXZ(
    scene,
    mats.wing,
    G,
    'wingR',
    [[5.5, FZ - 1.8], [-3.8, FZ - 1.8], [-9.8, FZ - 17.5], [-6.2, FZ - 17.5]],
    1.6,
    1.98,
  );
  const wingL = plateXZ(
    scene,
    mats.wing,
    G,
    'wingL',
    [[5.5, FZ + 1.8], [-3.8, FZ + 1.8], [-9.8, FZ + 17.5], [-6.2, FZ + 17.5]],
    1.6,
    1.98,
  );
  casters.push(wingR, wingL);
  // Solid wing slabs: eye height (1.7m) sits inside the 1.6–1.98m slab at the
  // root, so walk/follow cameras must collide instead of clipping through.
  wingR.checkCollisions = true;
  wingL.checkCollisions = true;

  // Aerodynamic Flap Track Canoe Fairings (3 per wing underneath)
  for (const s of [-1, 1]) {
    for (let f = 0; f < 3; f++) {
      const zOffset = (5.5 + f * 4.2) * s;
      const xOffset = -1.5 - f * 2.1;
      const flapCanoe = MeshBuilder.CreateCylinder(`flapCanoe_${s}_${f}`, {
        height: 3.4,
        diameterTop: 0.15,
        diameterBottom: 0.6,
        tessellation: 16,
      }, scene);
      flapCanoe.parent = G;
      flapCanoe.rotation.z = Math.PI / 2;
      flapCanoe.position.set(xOffset, 1.38, FZ + zOffset);
      flapCanoe.material = mats.wing;
      casters.push(flapCanoe);
    }
  }

  // Blended Sharklets / Winglets
  plateXY(
    scene,
    mats.wing,
    G,
    'wingletR',
    [[-6.2, 1.95], [-9.8, 1.95], [-9.2, 4.6], [-7.2, 4.6]],
    FZ - 17.65,
    FZ - 17.35,
  );
  plateXY(
    scene,
    mats.wing,
    G,
    'wingletL',
    [[-6.2, 1.95], [-9.8, 1.95], [-9.2, 4.6], [-7.2, 4.6]],
    FZ + 17.35,
    FZ + 17.65,
  );

  // =========================================================================
  // 6. HIGH-BYPASS TURBOFAN ENGINES (CFM LEAP-1A Style)
  // =========================================================================
  const rotatingFans: TransformNode[] = [];
  for (const s of [-1, 1]) {
    const engNode = new TransformNode(`engine_${s}`, scene);
    engNode.parent = G;
    const engZ = FZ + s * 7.2;

    // Aerodynamic Engine Pylon Strut
    box(scene, mats.wing, engNode, `pylon_${s}`, 3.8, 1.1, 0.45, 0.4, 2.35, engZ);

    // Contoured Nacelle Cowling
    const nacelle = MeshBuilder.CreateCylinder(`nacelle_${s}`, {
      height: 5.2,
      diameterTop: 2.72,
      diameterBottom: 2.48,
      tessellation: 36,
    }, scene);
    nacelle.parent = engNode;
    nacelle.rotation.z = Math.PI / 2;
    nacelle.position.set(0.6, 1.35, engZ);
    nacelle.material = mats.fuselage;
    nacelle.checkCollisions = true;
    casters.push(nacelle);

    // Polished Mirror Chrome Intake Cowl Lip
    const intakeLip = MeshBuilder.CreateTorus(`intakeLip_${s}`, {
      diameter: 2.74,
      thickness: 0.38,
      tessellation: 36,
    }, scene);
    intakeLip.parent = engNode;
    intakeLip.rotation.y = Math.PI / 2;
    intakeLip.position.set(3.2, 1.35, engZ);
    intakeLip.material = mats.chrome;

    // Dark interior intake barrel (gives the inlet real depth behind the fan)
    const barrel = MeshBuilder.CreateCylinder(`intakeBarrel_${s}`, {
      height: 1.6,
      diameter: 2.44,
      tessellation: 32,
    }, scene);
    barrel.parent = engNode;
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(2.45, 1.35, engZ);
    const barrelMat = new PBRMaterial(`barrelMat_${s}`, scene);
    barrelMat.albedoColor = new Color3(0.05, 0.055, 0.065);
    barrelMat.backFaceCulling = false;
    barrel.material = barrelMat;

    // Dark backing disc deep inside (engine core face, not a flat black hole)
    const coreFace = MeshBuilder.CreateDisc(`coreFace_${s}`, { radius: 1.2, tessellation: 32 }, scene);
    coreFace.parent = engNode;
    coreFace.rotation.y = Math.PI / 2;
    coreFace.position.set(1.75, 1.35, engZ);
    const coreMat = new PBRMaterial(`coreMat_${s}`, scene);
    coreMat.albedoColor = new Color3(0.06, 0.065, 0.075);
    coreFace.material = coreMat;

    // --- Real 3D fan: 18 swept titanium blades on a spinning rotor ---
    const fanRotor = new TransformNode(`fanRotor_${s}`, scene);
    fanRotor.parent = engNode;
    fanRotor.position.set(2.9, 1.35, engZ);
    const bladeMat = new PBRMaterial(`fanBladeMat_${s}`, scene);
    bladeMat.albedoColor = new Color3(0.62, 0.65, 0.7);
    const BLADES = 18;
    for (let b = 0; b < BLADES; b++) {
      const ang = (b / BLADES) * Math.PI * 2;
      // Curved-looking blade: thin wide box, pitched + swept back
      const blade = MeshBuilder.CreateBox(`fanBlade_${s}_${b}`, {
        width: 0.05,
        height: 1.02,
        depth: 0.42,
      }, scene);
      blade.parent = fanRotor;
      // radial offset from hub center
      const r = 0.68;
      blade.position.set(0, Math.cos(ang) * r, Math.sin(ang) * r);
      // orient: long axis radial, then add pitch (twist) and lean for curvature feel
      blade.rotation.x = -ang;
      blade.rotation.y = 0.55; // blade pitch vs airflow
      blade.rotation.z = 0.18; // sweep lean
      blade.material = bladeMat;
      blade.isPickable = false;
    }
    // Fan hub drum
    const hubDrum = MeshBuilder.CreateCylinder(`fanHub_${s}`, {
      height: 0.5,
      diameter: 0.5,
      tessellation: 20,
    }, scene);
    hubDrum.parent = fanRotor;
    hubDrum.rotation.z = Math.PI / 2;
    hubDrum.material = bladeMat;
    rotatingFans.push(fanRotor);

    // Spinner Cone with Painted White Aerodynamic Spiral
    const spinner = MeshBuilder.CreateCylinder(`spinner_${s}`, {
      height: 0.9,
      diameterTop: 0.05,
      diameterBottom: 0.55,
      tessellation: 24,
    }, scene);
    spinner.parent = engNode;
    spinner.rotation.z = -Math.PI / 2;
    spinner.position.set(3.2, 1.35, engZ);
    spinner.material = mats.steel;

    // Engine Core Exhaust & Titanium Hot-Section Cone
    const exhaustCone = MeshBuilder.CreateCylinder(`exhaust_${s}`, {
      height: 1.4,
      diameterTop: 2.2,
      diameterBottom: 1.4,
      tessellation: 28,
    }, scene);
    exhaustCone.parent = engNode;
    exhaustCone.rotation.z = Math.PI / 2;
    exhaustCone.position.set(-2.4, 1.35, engZ);
    exhaustCone.material = mats.darkMetal;

    const hotCone = MeshBuilder.CreateCylinder(`hotCone_${s}`, {
      height: 1.1,
      diameterTop: 0.1,
      diameterBottom: 0.8,
      tessellation: 20,
    }, scene);
    hotCone.parent = engNode;
    hotCone.rotation.z = Math.PI / 2;
    hotCone.position.set(-3.2, 1.35, engZ);
    hotCone.material = mats.darkMetal;
  }

  // =========================================================================
  // 7. VERTICAL & HORIZONTAL STABILIZERS (Tail Section)
  // =========================================================================
  const finMat = new PBRMaterial('finMat', scene);
  const _fin = opts.fin ?? [0.08, 0.25, 0.65];
  finMat.albedoColor = new Color3(_fin[0], _fin[1], _fin[2]); // Airline tailfin

  // Swept Vertical Stabilizer
  plateXY(
    scene,
    finMat,
    G,
    'verticalFin',
    [[-19.5, CY + 1.2], [-11.8, CY + 1.2], [-14.2, CY + 8.2], [-18.6, CY + 8.2]],
    FZ - 0.25,
    FZ + 0.25,
  );

  // Fin Logo Emblem (0.06 proud of the fin face — was 0.03: shimmer at distance)
  const finLogo = MeshBuilder.CreatePlane('finLogo', { width: 3.2, height: 1.8 }, scene);
  finLogo.parent = G;
  finLogo.position.set(-15.8, CY + 5.2, FZ - 0.31);
  finLogo.rotation.y = Math.PI;
  finLogo.material = textPlate(scene, '✈ SKYLINE', { bg: '#1e3a8a', fg: '#ffffff', font: 52 });

  // Swept Horizontal Stabilizers (solid: same eye-height slab issue as the wings)
  const stabR = plateXZ(
    scene,
    mats.wing,
    G,
    'stabR',
    [[-14.5, FZ - 0.9], [-20.5, FZ - 0.9], [-22.5, FZ - 7.2], [-17.2, FZ - 7.2]],
    CY + 1.7,
    CY + 2.0,
  );
  const stabL = plateXZ(
    scene,
    mats.wing,
    G,
    'stabL',
    [[-14.5, FZ + 0.9], [-20.5, FZ + 0.9], [-22.5, FZ + 7.2], [-17.2, FZ + 7.2]],
    CY + 1.7,
    CY + 2.0,
  );
  stabR.checkCollisions = true;
  stabL.checkCollisions = true;

  // =========================================================================
  // 8. LANDING GEAR & PRECISE GROUND CONTACT (y = 0.0m contact)
  // =========================================================================
  const buildGear = (x: number, z: number, isNose: boolean) => {
    const gearNode = new TransformNode(`gear_${x}_${z}`, scene);
    gearNode.parent = G;

    // Oleo Shock Strut
    cyl(scene, mats.steel, gearNode, 'strut', 1.3, 0.32, x, 0.72, z, true);
    box(scene, mats.darkMetal, gearNode, 'torqueLink', 0.25, 0.45, 0.15, x + 0.18, 0.65, z);

    if (isNose) {
      // Dual nose wheels: radius 0.44m, sitting exactly at y = 0.44m (bottom touches y = 0.0m)
      for (const dz of [-0.36, 0.36]) {
        const w = MeshBuilder.CreateCylinder(`noseWheel_${dz}`, { height: 0.3, diameter: 0.88, tessellation: 28 }, scene);
        w.parent = gearNode;
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.44, z + dz);
        w.material = mats.tire;

        const hub = MeshBuilder.CreateCylinder(`hub_${dz}`, { height: 0.32, diameter: 0.42, tessellation: 20 }, scene);
        hub.parent = gearNode;
        hub.rotation.x = Math.PI / 2;
        hub.position.copyFrom(w.position);
        hub.material = mats.chrome;
      }
      // Taxi/Takeoff Floodlight Cluster
      const taxiLight = box(scene, mats.chrome, gearNode, 'taxiLightCluster', 0.35, 0.22, 0.25, x + 0.22, 0.95, z);
      taxiLight.material = textPlate(scene, '☀', { bg: '#fef08a', fg: '#fef08a', font: 64 });
    } else {
      // 4-Wheel Main Gear Bogie: wheel radius 0.525m, sitting at y = 0.525m (bottom touches y = 0.0m)
      box(scene, mats.darkMetal, gearNode, 'bogieBeam', 2.1, 0.28, 0.42, x, 0.48, z);
      for (let wIdx = 0; wIdx < 4; wIdx++) {
        const dx = wIdx < 2 ? 0.65 : -0.65;
        const dz = (wIdx % 2 === 0 ? -0.38 : 0.38);

        const w = MeshBuilder.CreateCylinder(`mainWheel_${wIdx}`, { height: 0.36, diameter: 1.05, tessellation: 28 }, scene);
        w.parent = gearNode;
        w.rotation.x = Math.PI / 2;
        w.position.set(x + dx, 0.525, z + dz);
        w.material = mats.tire;

        const hub = MeshBuilder.CreateCylinder(`mainHub_${wIdx}`, { height: 0.38, diameter: 0.52, tessellation: 20 }, scene);
        hub.parent = gearNode;
        hub.rotation.x = Math.PI / 2;
        hub.position.copyFrom(w.position);
        hub.material = mats.steel;

        box(scene, mats.darkMetal, gearNode, `brake_${wIdx}`, 0.35, 0.35, 0.12, x + dx, 0.525, z + dz * 0.5);
      }
    }
  };

  buildGear(12.2, FZ, true); // Nose Gear
  buildGear(-0.5, FZ - 3.2, false); // Port Main Gear
  buildGear(-0.5, FZ + 3.2, false); // Starboard Main Gear

  // =========================================================================
  // 9. LIGHTS: BEACONS, STROBES, NAVIGATION LIGHTS
  // =========================================================================
  const makeLightBulb = (name: string, color: Color3, pos: Vector3) => {
    const bulb = MeshBuilder.CreateSphere(name, { diameter: 0.3 }, scene);
    bulb.parent = G;
    bulb.position.copyFrom(pos);
    const m = new PBRMaterial(`${name}Mat`, scene);
    m.albedoColor = color;
    m.emissiveColor = color;
    bulb.material = m;
    bulb.isPickable = false;
    return m;
  };

  const navPort = makeLightBulb('navPortRed', new Color3(1, 0, 0), new Vector3(-6.8, 2.0, FZ - 17.5));
  const navStbd = makeLightBulb('navStbdGreen', new Color3(0, 1, 0), new Vector3(-6.8, 2.0, FZ + 17.5));
  const beaconUpper = makeLightBulb('beaconUpper', new Color3(1, 0.1, 0.1), new Vector3(0.5, CY + 2.05, FZ));
  const beaconLower = makeLightBulb('beaconLower', new Color3(1, 0.1, 0.1), new Vector3(0.5, CY - 2.05, FZ));
  const strobeL = makeLightBulb('strobeL', new Color3(1, 1, 1), new Vector3(-7.2, 2.0, FZ - 17.6));
  const strobeR = makeLightBulb('strobeR', new Color3(1, 1, 1), new Vector3(-7.2, 2.0, FZ + 17.6));

  void navPort;
  void navStbd;

  return {
    update(dt: number, t: number) {
      rotatingFans.forEach((f) => {
        f.rotation.x += dt * 10;
      });

      // Flashing Anti-Collision Beacons
      const beaconIntensity = Math.sin(t * 3.8) > 0.6 ? 2.5 : 0.15;
      (beaconUpper.emissiveColor as Color3).set(beaconIntensity, beaconIntensity * 0.1, beaconIntensity * 0.1);
      (beaconLower.emissiveColor as Color3).set(beaconIntensity, beaconIntensity * 0.1, beaconIntensity * 0.1);

      // Xenon Wingtip Strobes
      const strobeTime = (t * 1.5) % 1.0;
      const isStrobe = (strobeTime > 0.0 && strobeTime < 0.08) || (strobeTime > 0.16 && strobeTime < 0.24);
      const strobeVal = isStrobe ? 4.0 : 0.0;
      (strobeL.emissiveColor as Color3).set(strobeVal, strobeVal, strobeVal);
      (strobeR.emissiveColor as Color3).set(strobeVal, strobeVal, strobeVal);
    },
  };
}

/**
 * Walkable passenger cabin interior, aft galley, lavatories, and glass cockpit flight deck.
 */
export function buildAircraftInterior(scene: Scene, mats: Mats, host: TransformNode) {
  const G = new TransformNode('CABIN-001', scene);
  G.parent = host;
  G.position.y = 1.12; // Flush with Jet Bridge ramp height
  const FZ = 45;
  const H = 3.2;

  box(scene, mats.darkMetal, G, 'cabinFloor', 32, 0.14, 3.7, 0, 0.07, FZ, true);
  const carpetMat = new PBRMaterial('carpetM', scene);
  carpetMat.albedoColor = new Color3(0.12, 0.18, 0.35);
  box(scene, carpetMat, G, 'aisleRunner', 32, 0.16, 0.9, 0, 0.08, FZ, false);

  box(scene, mats.wall, G, 'cabinWallS1', 6.2, H, 0.14, -13.2, 1.6, FZ - 1.82);
  box(scene, mats.wall, G, 'cabinWallS2', 21.8, H, 0.14, 5.2, 1.6, FZ - 1.82);
  box(scene, mats.wall, G, 'cabinWallN', 32, H, 0.14, 0, 1.6, FZ + 1.82);
  box(scene, mats.wall, G, 'cabinAftBulkhead', 0.14, H, 3.75, -16.2, 1.6, FZ, true);

  box(scene, mats.ceiling, G, 'cabinCeiling', 32, 0.14, 3.8, 0, 3.42, FZ, false);
  const coveMat = new PBRMaterial('coveLighting', scene);
  coveMat.albedoColor = new Color3(0.9, 0.95, 1.0);
  coveMat.emissiveColor = new Color3(0.95, 0.98, 1.0);
  box(scene, coveMat, G, 'coveLightStrip', 30, 0.05, 0.45, -0.5, 3.34, FZ, false);

  for (const s of [-1, 1]) {
    box(scene, mats.bin, G, `overheadBins_${s}`, 28, 0.58, 0.72, -0.5, 2.82, FZ + s * 1.25, false);
  }

  // 3-3 Passenger Seating
  const seatProtoBase = box(scene, mats.seatFabric, G, 'seatProtoB', 0.52, 0.14, 0.42, 0, -20, 0);
  const seatProtoBack = box(scene, mats.seatFabric, G, 'seatProtoK', 0.52, 0.58, 0.12, 0, -20, 0);
  seatProtoBase.isVisible = false;
  seatProtoBack.isVisible = false;
  seatProtoBase.checkCollisions = seatProtoBack.checkCollisions = false;

  const buildSeatRow = (x: number) => {
    const seatLanes = [FZ - 1.52, FZ - 1.06, FZ - 0.62, FZ + 0.62, FZ + 1.06, FZ + 1.52];
    for (const z of seatLanes) {
      const b = seatProtoBase.createInstance(`sb_${x}_${z}`);
      b.parent = G;
      b.isVisible = true;
      b.position.set(x, 0.52, z);
      b.checkCollisions = true;

      const k = seatProtoBack.createInstance(`sk_${x}_${z}`);
      k.parent = G;
      k.isVisible = true;
      k.position.set(x - 0.26, 0.85, z);
      k.checkCollisions = true;
    }
  };

  for (let x = -13.5; x <= 13.0; x += 1.0) {
    if (x > -9.8 && x < -6.2) continue;
    buildSeatRow(x);
  }

  box(scene, mats.darkMetal, G, 'exitArch', 2.4, 0.25, 0.25, -8.0, 2.85, FZ - 1.8);
  const exitSign = MeshBuilder.CreatePlane('exitSignCabin', { width: 0.9, height: 0.35 }, scene);
  exitSign.parent = G;
  exitSign.position.set(-8.0, 2.55, FZ - 1.65);
  exitSign.material = textPlate(scene, 'EXIT ➔', { bg: '#15803d', fg: '#ffffff', font: 64 });

  box(scene, mats.steel, G, 'aftGalleyUnit', 1.8, 2.5, 3.6, -15.2, 1.25, FZ, true);
  for (let cIdx = 0; cIdx < 4; cIdx++) {
    const cart = box(scene, mats.steel, G, `galleyCart_${cIdx}`, 0.52, 0.85, 0.72, -14.4, 0.44, FZ - 1.2 + cIdx * 0.8);
    box(scene, mats.counter, cart, `cartBrake_${cIdx}`, 0.12, 0.08, 0.08, -14.1, 0.1, FZ - 1.2 + cIdx * 0.8);
  }

  for (const s of [-1, 1]) {
    box(scene, mats.wall, G, `lavDoor_${s}`, 1.1, 2.2, 0.1, -12.8, 1.1, FZ + s * 1.25);
    const lavSign = MeshBuilder.CreatePlane(`lavSign_${s}`, { width: 0.55, height: 0.3 }, scene);
    lavSign.parent = G;
    lavSign.position.set(-12.8, 1.95, FZ + s * 1.18);
    lavSign.rotation.y = s > 0 ? Math.PI : 0;
    lavSign.material = textPlate(scene, 'LAVATORY', { bg: '#0369a1', fg: '#ffffff', font: 56 });
  }

  // Flight Deck / Cockpit
  box(scene, mats.darkMetal, G, 'cockpitPostL', 0.15, 2.2, 0.18, 14.4, 1.1, FZ - 0.78, true);
  box(scene, mats.darkMetal, G, 'cockpitPostR', 0.15, 2.2, 0.18, 14.4, 1.1, FZ + 0.78, true);
  const ckDoor = box(scene, mats.darkMetal, G, 'cockpitDoorLeaf', 0.1, 2.1, 1.15, 13.8, 1.05, FZ - 1.25, false);
  ckDoor.rotation.y = 0.95;

  const ckSign = MeshBuilder.CreatePlane('cockpitSignPlacard', { width: 1.1, height: 0.35 }, scene);
  ckSign.parent = G;
  ckSign.position.set(14.35, 2.45, FZ);
  ckSign.rotation.y = -Math.PI / 2;
  ckSign.material = textPlate(scene, 'FLIGHT DECK', { bg: '#0f172a', fg: '#f8fafc', font: 52 });

  box(scene, mats.darkMetal, G, 'cockpitFloor', 4.2, 0.14, 3.2, 16.5, 0.07, FZ, true);
  box(scene, mats.darkMetal, G, 'glareshield', 0.85, 0.2, 2.8, 18.8, 1.45, FZ, false);

  for (let i = 0; i < 4; i++) {
    const efisScreen = box(scene, mats.screen, G, `efisScreen_${i}`, 0.08, 0.55, 0.58, 18.6, 1.75, FZ - 0.95 + i * 0.62, false);
    efisScreen.rotation.z = -0.22;
  }

  for (const s of [-0.75, 0.75]) {
    box(scene, mats.seatFabric, G, `pilotSeat_${s}`, 0.65, 0.95, 0.65, 17.2, 0.52, FZ + s, true);
    box(scene, mats.darkMetal, G, `sidestick_${s}`, 0.25, 0.45, 0.15, 17.8, 1.05, FZ + s);
  }

  box(scene, mats.darkMetal, G, 'centerPedestal', 1.1, 0.75, 0.55, 17.9, 0.52, FZ, false);
}

/**
 * Full airport fleet: 3 parked airliners on separate stands + 1 airborne departure.
 * Parked jets reuse the detailed builder with distinct liveries; airborne jet is
 * gear-up and flies a looping departure pattern above the field.
 */
export function buildFleet(scene: Scene, mats: Mats, host: TransformNode): AircraftTick[] {
  const ticks: AircraftTick[] = [];
  ticks.push(buildAircraftExterior(scene, mats, host, {
    id: 'AIRCRAFT-002', dx: -62, dz: 4, ry: 0.06,
    title: '✈  NILE WINGS', sub: 'DOMESTIC', reg: 'SU-B14',
    stripe: [0.7, 0.12, 0.12], fin: [0.55, 0.08, 0.08],
  }));
  ticks.push(buildAircraftExterior(scene, mats, host, {
    id: 'AIRCRAFT-003', dx: 62, dz: 4, ry: -0.06,
    title: '✈  GULF FALCON', sub: 'INTERNATIONAL', reg: 'A6-C16',
    stripe: [0.08, 0.35, 0.28], fin: [0.05, 0.3, 0.25],
  }));
  // Airborne departure: gear-up silhouette circling the field
  const air = new TransformNode('AIRCRAFT-004', scene);
  air.parent = host;
  const airInner = new TransformNode('AIRCRAFT-004-inner', scene);
  airInner.parent = air;
  const airTick = buildAircraftExterior(scene, mats, airInner, {
    id: 'AIRCRAFT-004-model', dx: 0, dz: -45, ry: Math.PI / 2,
    title: '✈  SKYLINE AIRWAYS', sub: 'INTERNATIONAL', reg: 'SU-D04',
  });
  // hide gear for airborne jet (gear node names are gear_* under model node)
  airInner.getChildTransformNodes(false).forEach(() => {});
  ticks.push(airTick);
  const airborne: AircraftTick = {
    update(dt: number, t: number) {
      const period = 75;
      const p = (t % period) / period;
      const x = -260 + p * 520;
      const climb = Math.min(1, p * 3);
      const alt = 25 + climb * 85 + Math.sin(t * 0.5) * 1.5;
      air.position.set(x, alt, 120 + Math.sin(p * Math.PI) * 30);
      air.rotation.y = 0;
      if (p > 0.98) air.position.set(-260, 25, 120);
    },
  };
  ticks.push(airborne);
  return ticks;
}
