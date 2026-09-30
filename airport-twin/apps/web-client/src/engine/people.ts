import { AnimationGroup, Color3, Mesh, MeshBuilder, Scene, PBRMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { ensureWalkCycle, playWalkCycle } from './walkAnim';

export type Role = 'passenger' | 'staff' | 'security' | 'crew' | 'pilot' | 'immigration' | 'customs';

const SKIN_TONES = [
  new Color3(0.96, 0.82, 0.72),
  new Color3(0.85, 0.68, 0.54),
  new Color3(0.72, 0.52, 0.38),
  new Color3(0.55, 0.38, 0.25),
  new Color3(0.38, 0.24, 0.16),
];

const HAIR_COLORS = [
  new Color3(0.12, 0.1, 0.08),
  new Color3(0.32, 0.22, 0.15),
  new Color3(0.65, 0.48, 0.28),
  new Color3(0.5, 0.52, 0.55),
];

const PASSENGER_CLOTHES = [
  new Color3(0.18, 0.32, 0.55), // navy blue blazer
  new Color3(0.65, 0.22, 0.25), // maroon coat
  new Color3(0.25, 0.45, 0.35), // forest green sweater
  new Color3(0.35, 0.38, 0.42), // charcoal jacket
  new Color3(0.75, 0.68, 0.58), // beige trench coat
  new Color3(0.12, 0.14, 0.18), // black suit
  new Color3(0.82, 0.55, 0.25), // terracotta cardigan
];

export interface Person {
  root: TransformNode;
  update(dt: number, t: number): void;
  setWalking?(w: boolean, s?: number): void;
}

/**
 * Anatomically accurate 3D humanoid character:
 * Head (with hair/cap), neck, shoulders, torso, arms with hands, legs with shoes,
 * role uniforms (vests, badges, epaulets, ear protection, luggage).
 */
export function makePerson(scene: Scene, role: Role, skinIdx = 0, variant = 0): Person {
  const root = new TransformNode(`person_${role}_${Math.floor(Math.random() * 1e6)}`, scene);
  // Real-human stature variation: adults 0.92–1.08, ~8% children at 0.62–0.72
  const isChild = Math.random() < 0.08 && role === 'passenger';
  const stature = isChild ? 0.62 + Math.random() * 0.1 : 0.92 + Math.random() * 0.16;
  const bulk = 0.92 + Math.random() * 0.16;
  root.scaling.set(bulk, stature, bulk);

  const skinMat = new PBRMaterial('skinMat', scene);
  skinMat.albedoColor = SKIN_TONES[skinIdx % SKIN_TONES.length];

  const hairMat = new PBRMaterial('hairMat', scene);
  hairMat.albedoColor = HAIR_COLORS[variant % HAIR_COLORS.length];

  const darkMat = new PBRMaterial('darkCloth', scene);
  darkMat.albedoColor = new Color3(0.12, 0.13, 0.16);

  const whiteShirtMat = new PBRMaterial('whiteShirt', scene);
  whiteShirtMat.albedoColor = new Color3(0.95, 0.96, 0.98);

  const mainClothMat = new PBRMaterial('mainCloth', scene);
  if (role === 'passenger') {
    mainClothMat.albedoColor = PASSENGER_CLOTHES[variant % PASSENGER_CLOTHES.length];
  } else if (role === 'staff') {
    mainClothMat.albedoColor = new Color3(0.12, 0.24, 0.48); // airline navy
  } else if (role === 'security') {
    mainClothMat.albedoColor = new Color3(0.08, 0.1, 0.14); // tactical black
  } else if (role === 'crew') {
    mainClothMat.albedoColor = new Color3(0.18, 0.22, 0.28); // work navy
  } else if (role === 'pilot') {
    mainClothMat.albedoColor = new Color3(0.08, 0.12, 0.22); // captain jacket
  } else if (role === 'immigration') {
    mainClothMat.albedoColor = new Color3(0.1, 0.18, 0.32); // border agency navy
  } else if (role === 'customs') {
    mainClothMat.albedoColor = new Color3(0.14, 0.28, 0.22); // customs dark green
  }

  const parts: Mesh[] = [];
  const add = (m: Mesh, parent?: TransformNode) => {
    m.parent = parent ?? root;
    m.isPickable = false;
    parts.push(m);
    return m;
  };

  // --- Head & Neck ---
  const headGroup = new TransformNode('headGroup', scene);
  headGroup.parent = root;
  headGroup.position.y = 1.48;

  const head = add(MeshBuilder.CreateSphere('head', { diameterX: 0.21, diameterY: 0.24, diameterZ: 0.22, segments: 12 }, scene), headGroup);
  head.material = skinMat;
  head.position.y = 0.12;

  // Face: eyes + brows + nose + mouth so people read as real at 1–3 m
  const eyeWhite = new PBRMaterial('eyeW', scene);
  eyeWhite.albedoColor = new Color3(0.96, 0.96, 0.94);
  const pupilM = new PBRMaterial('pupil', scene);
  pupilM.albedoColor = new Color3(0.12, 0.09, 0.07);
  for (const ex of [-0.045, 0.045]) {
    const eye = add(MeshBuilder.CreateSphere('eye', { diameter: 0.032 }, scene), headGroup);
    eye.position.set(ex, 0.14, 0.1);
    eye.material = eyeWhite;
    const pup = add(MeshBuilder.CreateSphere('pupil', { diameter: 0.014 }, scene), headGroup);
    pup.position.set(ex, 0.14, 0.115);
    pup.material = pupilM;
  }
  const nose = add(MeshBuilder.CreateBox('nose', { width: 0.025, height: 0.045, depth: 0.025 }, scene), headGroup);
  nose.position.set(0, 0.1, 0.115);
  nose.material = skinMat;
  const mouthM = new PBRMaterial('mouth', scene);
  mouthM.albedoColor = new Color3(0.45, 0.22, 0.2);
  const mouth = add(MeshBuilder.CreateBox('mouth', { width: 0.055, height: 0.012, depth: 0.01 }, scene), headGroup);
  mouth.position.set(0, 0.055, 0.11);
  mouth.material = mouthM;

  const neck = add(MeshBuilder.CreateCylinder('neck', { height: 0.08, diameter: 0.11, tessellation: 8 }, scene), headGroup);
  neck.material = skinMat;
  neck.position.y = 0.02;

  // Role Headwear
  if (role === 'pilot') {
    const capCrown = add(MeshBuilder.CreateCylinder('capCrown', { height: 0.08, diameterTop: 0.25, diameterBottom: 0.23, tessellation: 12 }, scene), headGroup);
    capCrown.position.y = 0.23;
    capCrown.material = mainClothMat;
    const visor = add(MeshBuilder.CreateBox('visor', { width: 0.2, height: 0.02, depth: 0.12 }, scene), headGroup);
    visor.position.set(0, 0.19, 0.12);
    visor.rotation.x = 0.25;
    visor.material = darkMat;
    const goldBand = add(MeshBuilder.CreateCylinder('goldBand', { height: 0.02, diameter: 0.24, tessellation: 12 }, scene), headGroup);
    goldBand.position.y = 0.2;
    const goldMat = new PBRMaterial('goldM', scene);
    goldMat.albedoColor = new Color3(0.9, 0.75, 0.1);
    goldBand.material = goldMat;
  } else if (role === 'security' || role === 'immigration' || role === 'customs') {
    const cap = add(MeshBuilder.CreateCylinder('secCap', { height: 0.07, diameterTop: 0.24, diameterBottom: 0.22, tessellation: 12 }, scene), headGroup);
    cap.position.y = 0.22;
    cap.material = darkMat;
    const badge = add(MeshBuilder.CreateBox('badge', { width: 0.04, height: 0.04, depth: 0.02 }, scene), headGroup);
    badge.position.set(0, 0.22, 0.12);
    const goldMat = new PBRMaterial('goldM', scene);
    goldMat.albedoColor = new Color3(0.9, 0.8, 0.1);
    badge.material = goldMat;
  } else if (role === 'crew') {
    const muffsL = add(MeshBuilder.CreateCylinder('muffL', { height: 0.05, diameter: 0.1, tessellation: 10 }, scene), headGroup);
    muffsL.rotation.z = Math.PI / 2;
    muffsL.position.set(-0.12, 0.12, 0);
    const hiVisM = new PBRMaterial('hiVisEar', scene);
    hiVisM.albedoColor = new Color3(0.95, 0.85, 0.05);
    muffsL.material = hiVisM;

    const muffsR = add(MeshBuilder.CreateCylinder('muffR', { height: 0.05, diameter: 0.1, tessellation: 10 }, scene), headGroup);
    muffsR.rotation.z = Math.PI / 2;
    muffsR.position.set(0.12, 0.12, 0);
    muffsR.material = hiVisM;

    const muffBand = add(MeshBuilder.CreateTorus('muffBand', { diameter: 0.24, thickness: 0.02, tessellation: 12 }, scene), headGroup);
    muffBand.position.set(0, 0.22, 0);
    muffBand.rotation.x = Math.PI / 2;
    muffBand.material = darkMat;
  } else {
    const hair = add(MeshBuilder.CreateSphere('hair', { diameterX: 0.23, diameterY: 0.18, diameterZ: 0.24, segments: 10 }, scene), headGroup);
    hair.position.set(0, 0.17, -0.02);
    hair.material = hairMat;
  }

  // --- Torso & Uniform ---
  const torsoGroup = new TransformNode('torsoGroup', scene);
  torsoGroup.parent = root;
  torsoGroup.position.y = 1.08;

  const upperTorso = add(MeshBuilder.CreateBox('upperTorso', { width: 0.38, height: 0.32, depth: 0.22 }, scene), torsoGroup);
  upperTorso.position.y = 0.24;
  upperTorso.material = mainClothMat;

  const lowerTorso = add(MeshBuilder.CreateBox('lowerTorso', { width: 0.34, height: 0.24, depth: 0.2 }, scene), torsoGroup);
  lowerTorso.position.y = -0.02;
  lowerTorso.material = role === 'crew' ? darkMat : mainClothMat;

  if (role === 'pilot' || role === 'staff' || role === 'immigration') {
    const shirt = add(MeshBuilder.CreateBox('shirtCollar', { width: 0.14, height: 0.16, depth: 0.02 }, scene), torsoGroup);
    shirt.position.set(0, 0.32, 0.115);
    shirt.material = whiteShirtMat;
    const tie = add(MeshBuilder.CreateBox('tie', { width: 0.05, height: 0.22, depth: 0.02 }, scene), torsoGroup);
    tie.position.set(0, 0.24, 0.125);
    tie.material = darkMat;
  }

  if (role === 'pilot') {
    for (const sx of [-0.16, 0.16]) {
      const ep = add(MeshBuilder.CreateBox(`ep_${sx}`, { width: 0.07, height: 0.02, depth: 0.12 }, scene), torsoGroup);
      ep.position.set(sx, 0.41, 0);
      const epMat = new PBRMaterial('epMat', scene);
      epMat.albedoColor = new Color3(0.9, 0.75, 0.1);
      ep.material = epMat;
    }
  }

  if (role === 'crew') {
    const vest = add(MeshBuilder.CreateBox('hiVisVest', { width: 0.4, height: 0.44, depth: 0.24 }, scene), torsoGroup);
    vest.position.y = 0.16;
    const vestMat = new PBRMaterial('vestM', scene);
    vestMat.albedoColor = new Color3(0.95, 0.45, 0.05);
    vestMat.emissiveColor = new Color3(0.35, 0.15, 0.02);
    vest.material = vestMat;

    const stripeMat = new PBRMaterial('stripes', scene);
    stripeMat.albedoColor = new Color3(0.9, 0.92, 0.95);
    stripeMat.emissiveColor = new Color3(0.6, 0.62, 0.65);

    const stripeH = add(MeshBuilder.CreateBox('strH', { width: 0.41, height: 0.05, depth: 0.25 }, scene), torsoGroup);
    stripeH.position.y = 0.08;
    stripeH.material = stripeMat;

    for (const sx of [-0.1, 0.1]) {
      const stripeV = add(MeshBuilder.CreateBox(`strV_${sx}`, { width: 0.04, height: 0.38, depth: 0.25 }, scene), torsoGroup);
      stripeV.position.set(sx, 0.2, 0);
      stripeV.material = stripeMat;
    }
  }

  // --- Arms & Hands ---
  const leftArmGroup = new TransformNode('leftArmGroup', scene);
  leftArmGroup.parent = root;
  leftArmGroup.position.set(-0.24, 1.4, 0);

  const leftArm = add(MeshBuilder.CreateCapsule('leftArm', { radius: 0.055, height: 0.52 }, scene), leftArmGroup);
  leftArm.position.y = -0.22;
  leftArm.material = role === 'crew' ? darkMat : mainClothMat;
  const leftHand = add(MeshBuilder.CreateSphere('leftHand', { diameter: 0.08 }, scene), leftArmGroup);
  leftHand.position.y = -0.48;
  leftHand.material = skinMat;

  const rightArmGroup = new TransformNode('rightArmGroup', scene);
  rightArmGroup.parent = root;
  rightArmGroup.position.set(0.24, 1.4, 0);

  const rightArm = add(MeshBuilder.CreateCapsule('rightArm', { radius: 0.055, height: 0.52 }, scene), rightArmGroup);
  rightArm.position.y = -0.22;
  rightArm.material = role === 'crew' ? darkMat : mainClothMat;
  const rightHand = add(MeshBuilder.CreateSphere('rightHand', { diameter: 0.08 }, scene), rightArmGroup);
  rightHand.position.y = -0.48;
  rightHand.material = skinMat;

  // Marshalling Wands for Ramp Crew
  if (role === 'crew' && variant % 2 === 0) {
    const wand = add(MeshBuilder.CreateCylinder('wand', { height: 0.28, diameter: 0.035, tessellation: 8 }, scene), rightArmGroup);
    wand.position.set(0, -0.55, 0.08);
    wand.rotation.x = Math.PI / 3;
    const wandMat = new PBRMaterial('wandM', scene);
    wandMat.albedoColor = new Color3(1, 0.2, 0.05);
    wandMat.emissiveColor = new Color3(0.8, 0.15, 0.05);
    wand.material = wandMat;
  }

  // --- Legs & Shoes ---
  const leftLegGroup = new TransformNode('leftLegGroup', scene);
  leftLegGroup.parent = root;
  leftLegGroup.position.set(-0.11, 0.92, 0);

  const blueJeansMat = new PBRMaterial('blueJeansMat', scene);
  blueJeansMat.albedoColor = new Color3(0.15, 0.22, 0.38);

  const leftLeg = add(MeshBuilder.CreateCapsule('leftLeg', { radius: 0.07, height: 0.8 }, scene), leftLegGroup);
  leftLeg.position.y = -0.38;
  leftLeg.material = role === 'passenger' && variant % 3 === 0 ? blueJeansMat : darkMat;
  const leftShoe = add(MeshBuilder.CreateBox('leftShoe', { width: 0.12, height: 0.09, depth: 0.22 }, scene), leftLegGroup);
  leftShoe.position.set(0, -0.84, 0.04);
  leftShoe.material = darkMat;

  const rightLegGroup = new TransformNode('rightLegGroup', scene);
  rightLegGroup.parent = root;
  rightLegGroup.position.set(0.11, 0.92, 0);

  const rightLeg = add(MeshBuilder.CreateCapsule('rightLeg', { radius: 0.07, height: 0.8 }, scene), rightLegGroup);
  rightLeg.position.y = -0.38;
  rightLeg.material = leftLeg.material;
  const rightShoe = add(MeshBuilder.CreateBox('rightShoe', { width: 0.12, height: 0.09, depth: 0.22 }, scene), rightLegGroup);
  rightShoe.position.set(0, -0.84, 0.04);
  rightShoe.material = darkMat;

  // --- Rolling Luggage Suitcase ---
  let luggageGroup: TransformNode | null = null;
  if ((role === 'passenger' && variant % 2 === 1) || role === 'pilot') {
    luggageGroup = new TransformNode('luggage', scene);
    luggageGroup.parent = root;
    luggageGroup.position.set(0.38, 0, -0.15);

    const suitColor = role === 'pilot' ? new Color3(0.1, 0.1, 0.12) : PASSENGER_CLOTHES[(variant + 2) % PASSENGER_CLOTHES.length];
    const suitMat = new PBRMaterial('suitM', scene);
    suitMat.albedoColor = suitColor;

    const bag = add(MeshBuilder.CreateBox('bagBody', { width: 0.26, height: 0.48, depth: 0.35 }, scene), luggageGroup);
    bag.position.y = 0.32;
    bag.material = suitMat;

    for (const [dx, dz] of [[-0.1, -0.12], [0.1, -0.12], [-0.1, 0.12], [0.1, 0.12]]) {
      const w = add(MeshBuilder.CreateCylinder('lugWheel', { height: 0.03, diameter: 0.06 }, scene), luggageGroup);
      w.rotation.z = Math.PI / 2;
      w.position.set(dx, 0.04, dz);
      w.material = darkMat;
    }

    const handlePoleL = add(MeshBuilder.CreateCylinder('hPoleL', { height: 0.4, diameter: 0.015 }, scene), luggageGroup);
    handlePoleL.position.set(-0.06, 0.65, -0.12);
    handlePoleL.material = darkMat;
    const handlePoleR = add(MeshBuilder.CreateCylinder('hPoleR', { height: 0.4, diameter: 0.015 }, scene), luggageGroup);
    handlePoleR.position.set(0.06, 0.65, -0.12);
    handlePoleR.material = darkMat;
    const handleBar = add(MeshBuilder.CreateBox('hBar', { width: 0.15, height: 0.02, depth: 0.03 }, scene), luggageGroup);
    handleBar.position.set(0, 0.85, -0.12);
    handleBar.material = darkMat;

    rightArmGroup.rotation.x = -0.45;
    rightArmGroup.rotation.z = 0.15;
  }

  // Backpack for ~25% of passengers (real traveler look)
  if (role === 'passenger' && variant % 4 === 1) {
    const packMat = new PBRMaterial('packM', scene);
    packMat.albedoColor = PASSENGER_CLOTHES[(variant + 4) % PASSENGER_CLOTHES.length];
    const pack = add(MeshBuilder.CreateBox('backpack', { width: 0.26, height: 0.38, depth: 0.16 }, scene), torsoGroup);
    pack.position.set(0, 0.12, -0.19);
    pack.material = packMat;
  }
  // Phone in hand: head-down pose for ~30% of idle passengers
  let phonePose = false;
  if (role === 'passenger' && variant % 10 < 3) {
    phonePose = true;
    const phoneM = new PBRMaterial('phoneM', scene);
    phoneM.albedoColor = new Color3(0.05, 0.06, 0.08);
    phoneM.emissiveColor = new Color3(0.4, 0.55, 0.7);
    const phone = add(MeshBuilder.CreateBox('phone', { width: 0.07, height: 0.015, depth: 0.14 }, scene), rightArmGroup);
    phone.position.set(0, -0.52, 0.1);
    phone.material = phoneM;
    rightArmGroup.rotation.x = -0.85;
    leftArmGroup.rotation.x = -0.85;
    headGroup.rotation.x = 0.35;
  }

  const phase = Math.random() * Math.PI * 2;
  let isWalking = false;
  let walkSpeed = 1.0;
  // Step 3: real AnimationGroup walk cycle, created lazily on first stride.
  let walkGroup: AnimationGroup | null = null;
  const driveRightArm = !luggageGroup && !phonePose;

  const resetToIdlePose = () => {
    leftLegGroup.rotation.x = 0;
    rightLegGroup.rotation.x = 0;
    torsoGroup.rotation.y = 0;
    headGroup.rotation.y = 0;
    if (luggageGroup) {
      rightArmGroup.rotation.x = -0.45;
      rightArmGroup.rotation.z = 0.15;
    } else if (phonePose) {
      rightArmGroup.rotation.x = -0.85;
      leftArmGroup.rotation.x = -0.85;
      headGroup.rotation.x = 0.35;
    } else {
      leftArmGroup.rotation.x = 0;
      rightArmGroup.rotation.x = 0;
    }
  };

  const personApi: Person = {
    root,
    update(dt: number, t: number) {
      if (!isWalking) {
        const idleCycle = t * 1.6 + phase;
        torsoGroup.position.y = 1.08 + Math.sin(idleCycle) * 0.008;
        headGroup.rotation.y = Math.sin(idleCycle * 0.5) * 0.08;
        headGroup.rotation.x = phonePose ? 0.35 + Math.sin(idleCycle * 0.8) * 0.03 : Math.sin(idleCycle * 0.8) * 0.04;
        leftArmGroup.rotation.x = Math.sin(idleCycle) * 0.04;
        if (!luggageGroup) {
          rightArmGroup.rotation.x = -Math.sin(idleCycle) * 0.04;
        }
        return;
      }
      // Stride is driven by the looping walk AnimationGroup (phase + tempo
      // set in setWalking); nothing to write here per-frame.
    },
    setWalking(w: boolean, s = 1.0) {
      isWalking = w;
      walkSpeed = s;
      if (w) {
        if (!walkGroup) {
          walkGroup = ensureWalkCycle(scene, {
            leftLeg: leftLegGroup,
            rightLeg: rightLegGroup,
            leftArm: leftArmGroup,
            rightArm: rightArmGroup,
            torso: torsoGroup,
            head: headGroup,
            torsoBaseY: 1.08,
            driveRightArm,
          }, `${role}_${variant}`);
        }
        playWalkCycle(walkGroup, s);
      } else if (walkGroup?.isPlaying) {
        walkGroup.stop();
        resetToIdlePose();
      }
    },
  };

  return personApi;
}

interface JourneyWalker extends Person {
  waypoints: Vector3[];
  wpIndex: number;
  speed: number;
  wait: number;
  loop: boolean;
}

/**
 * Full End-to-End Passenger & Staff Simulation:
 * - Parking P1 ➔ Crosswalk ➔ Terminal Entrance
 * - Departure Check-In & Bag Drop Queues
 * - Security Checkpoint lines
 * - Gate A12 Boarding Line ➔ Jet Bridge ➔ Aircraft Door L2
 * - Arrivals deplaning ➔ Passport Control ➔ Baggage Claim ➔ Customs ➔ Pick-Up Exit
 * - Airport Staff, Immigration Officers, Customs Inspectors, Ramp Crew
 */
export function buildCrowd(scene: Scene, count = 130): {
  update(dt: number, t: number): void;
  meshes: TransformNode[];
  stats(): { total: number; zones: { name: string; count: number }[] };
} {
  const walkers: JourneyWalker[] = [];
  const spots: { x: number; z: number; role: Role; rotY?: number }[] = [];

  // =========================================================================
  // 1. DEDICATED JOURNEY PATH WALKERS
  // =========================================================================
  // Path A: Passenger from Parking P1 walking across crosswalk to Main Entrance
  const p1Walker = makePerson(scene, 'passenger', 0, 1);
  (p1Walker as any).waypoints = [
    new Vector3(-6, 0, -56), // Exiting parked car in P1
    new Vector3(0, 0, -50),  // Approaching crosswalk
    new Vector3(0, 0, -35),  // Walking down crosswalk
    new Vector3(0, 0, -22),  // Approaching entrance sliding doors
    new Vector3(0, 0, -16),  // Entering Departure Hall
  ];
  (p1Walker as any).wpIndex = 0;
  (p1Walker as any).speed = 0.95;
  (p1Walker as any).wait = 0;
  (p1Walker as any).loop = true;
  p1Walker.root.position.copyFrom((p1Walker as any).waypoints[0]);
  p1Walker.setWalking?.(true, 0.95);
  walkers.push(p1Walker as JourneyWalker);

  // Path B: Boarding Passenger from Gate A12 through Jet Bridge into Aircraft Cabin
  const boardWalker = makePerson(scene, 'passenger', 1, 3);
  (boardWalker as any).waypoints = [
    new Vector3(-8, 0, 14),   // At Gate A12 podium
    new Vector3(-8, 0, 20),   // Passing through gate turnstiles
    new Vector3(-8, 0.5, 30), // Walking down Jet Bridge ramp
    new Vector3(-8, 1.1, 41), // Entering aircraft door L2
    new Vector3(-4, 1.1, 45), // Walking down aircraft aisle
  ];
  (boardWalker as any).wpIndex = 0;
  (boardWalker as any).speed = 0.85;
  (boardWalker as any).wait = 0;
  (boardWalker as any).loop = true;
  boardWalker.root.position.copyFrom((boardWalker as any).waypoints[0]);
  boardWalker.setWalking?.(true, 0.85);
  walkers.push(boardWalker as JourneyWalker);

  // Path C: Arriving Passenger deplaning ➔ Passport Control ➔ Baggage Claim ➔ Customs ➔ Exit
  const arrivalWalker = makePerson(scene, 'passenger', 2, 5);
  (arrivalWalker as any).waypoints = [
    new Vector3(20, 0, 18),   // Arrivals corridor
    new Vector3(24, 0, 14),   // Entering Passport Control
    new Vector3(24, 0, 6),    // Passing E-Gate
    new Vector3(14, 0, -6),   // Entering Baggage Claim Hall
    new Vector3(18, 0, -16),  // Walking through Customs Green Channel
    new Vector3(20, 0, -24),  // Exiting to Arrival Pick-Up curb
  ];
  (arrivalWalker as any).wpIndex = 0;
  (arrivalWalker as any).speed = 0.9;
  (arrivalWalker as any).wait = 0;
  (arrivalWalker as any).loop = true;
  arrivalWalker.root.position.copyFrom((arrivalWalker as any).waypoints[0]);
  arrivalWalker.setWalking?.(true, 0.9);
  walkers.push(arrivalWalker as JourneyWalker);

  // =========================================================================
  // 2. STATIC & QUEUING PASSENGERS AND AIRPORT STAFF
  // =========================================================================
  // Parking & Curbside
  spots.push(
    { x: -14, z: -56, role: 'passenger', rotY: 0 },
    { x: 14, z: -56, role: 'passenger', rotY: Math.PI },
    { x: -16, z: -23, role: 'passenger', rotY: 0 },
    { x: 16, z: -23, role: 'passenger', rotY: 0 },
  );

  // Check-In Island Queues
  for (let i = 0; i < 8; i++) {
    spots.push({ x: -14 + (i % 4) * 1.2, z: -8.8 - Math.floor(i / 4) * 1.1, role: 'passenger', rotY: 0 });
    spots.push({ x: 0 + (i % 4) * 1.2, z: -8.8 - Math.floor(i / 4) * 1.1, role: 'passenger', rotY: 0 });
  }

  // Self Check-in Kiosks
  spots.push(
    { x: -21, z: -13.2, role: 'passenger', rotY: 0 },
    { x: -16.4, z: -13.2, role: 'passenger', rotY: 0 },
    { x: -11.8, z: -13.2, role: 'passenger', rotY: 0 },
  );

  // Check-In Airline Agents
  spots.push(
    { x: -14, z: -5.2, role: 'staff', rotY: Math.PI },
    { x: -10, z: -5.2, role: 'staff', rotY: Math.PI },
    { x: 0, z: -5.2, role: 'staff', rotY: Math.PI },
    { x: 4, z: -5.2, role: 'staff', rotY: Math.PI },
    { x: 8, z: -13.2, role: 'staff', rotY: 0 }, // Information desk
  );

  // Security Checkpoint Queues & Officers
  for (let i = 0; i < 6; i++) {
    spots.push({ x: -4 + (i % 2) * 1.4, z: -3.8 - Math.floor(i / 2) * 1.2, role: 'passenger', rotY: 0 });
  }
  spots.push(
    { x: -4, z: 0.6, role: 'security', rotY: Math.PI },
    { x: 2, z: 0.6, role: 'security', rotY: Math.PI },
    { x: -6, z: 2.2, role: 'security', rotY: Math.PI / 2 },
  );

  // Duty Free & Cafe
  spots.push(
    { x: -25, z: -2, role: 'passenger' },
    { x: -26, z: 5, role: 'passenger' },
    { x: -24, z: 1.5, role: 'passenger' },
  );

  // Gate Seating (Seated Passengers)
  const gateSeats: [number, number][] = [
    [-15.5, 12.5], [-14, 12.5], [-12.5, 12.5],
    [-9.5, 12.5], [-8, 12.5], [-6.5, 13.8],
    [-3.5, 12.5], [-2, 12.5], [-0.5, 12.5],
    [1.0, 13.8], [2.5, 13.8],
  ];

  // Gate Agents & Boarding Queue
  spots.push(
    { x: -14, z: 14.8, role: 'staff', rotY: Math.PI },
    { x: -8, z: 14.8, role: 'staff', rotY: Math.PI },
    { x: -2, z: 14.8, role: 'staff', rotY: Math.PI },
    { x: -8, z: 17.0, role: 'passenger', rotY: 0 },
    { x: -8, z: 18.2, role: 'passenger', rotY: 0 },
  );

  // Passport / Immigration Control (Queue & Officers)
  spots.push(
    { x: 26, z: 13, role: 'immigration', rotY: 0 },
    { x: 26, z: 15.8, role: 'immigration', rotY: 0 },
    { x: 23, z: 13, role: 'passenger', rotY: Math.PI / 2 },
    { x: 21, z: 13, role: 'passenger', rotY: Math.PI / 2 },
    { x: 23, z: 15.8, role: 'passenger', rotY: Math.PI / 2 },
  );

  // Baggage Reclaim Watching Passengers
  spots.push(
    { x: 9.5, z: -7.0, role: 'passenger', rotY: Math.PI / 2 },
    { x: 12.0, z: -9.8, role: 'passenger', rotY: -Math.PI / 2 },
    { x: 15.0, z: -7.0, role: 'passenger', rotY: -Math.PI / 2 },
    { x: 9.5, z: -13.0, role: 'passenger', rotY: Math.PI / 2 },
    { x: 12.0, z: -15.8, role: 'passenger', rotY: -Math.PI / 2 },
  );

  // Customs Officers & Inspecting Passengers
  spots.push(
    { x: 19.5, z: -15.5, role: 'customs', rotY: Math.PI },
    { x: 23, z: -14.5, role: 'customs', rotY: 0 },
    { x: 23, z: -16.0, role: 'passenger', rotY: Math.PI },
  );

  // Apron Ramp Crew around Aircraft Stand A12
  spots.push(
    { x: 4.5, z: 41.5, role: 'crew', rotY: -Math.PI / 2 },
    { x: -2, z: 41, role: 'crew', rotY: Math.PI / 4 },
    { x: 0, z: 50.5, role: 'crew', rotY: 0 },
    { x: -4, z: 49, role: 'crew', rotY: -Math.PI / 4 },
    { x: 8, z: 44, role: 'crew', rotY: -Math.PI / 2 },
    { x: -7.5, z: 32, role: 'crew', rotY: 0 },
    // Stands B14 / C16 servicing crews + fuel + catering queues
    { x: -30, z: 44, role: 'crew', rotY: 0 },
    { x: -27, z: 48, role: 'crew', rotY: Math.PI },
    { x: -33, z: 50, role: 'crew', rotY: Math.PI / 2 },
    { x: 30, z: 44, role: 'crew', rotY: 0 },
    { x: 27, z: 48, role: 'crew', rotY: Math.PI },
    { x: 33, z: 50, role: 'crew', rotY: -Math.PI / 2 },
    { x: -30, z: 52, role: 'passenger', rotY: 0 },
    { x: 30, z: 52, role: 'passenger', rotY: 0 },
  );
  // Landside food-court / meeters-and-greeters bustle
  for (let i = 0; i < 10; i++) {
    spots.push({ x: -24 + (i % 5) * 3.2, z: 2 + Math.floor(i / 5) * 2.4, role: 'passenger' });
  }
  // Long check-in switchback queues
  for (let i = 0; i < 10; i++) {
    spots.push({ x: -16 + (i % 5) * 1.1, z: -11.5 - Math.floor(i / 5) * 1.1, role: 'passenger', rotY: 0 });
  }

  // Flight Deck Pilots & Cabin Crew
  spots.push(
    { x: 17.2, z: 44.3, role: 'pilot', rotY: Math.PI / 2 },
    { x: 17.2, z: 45.7, role: 'pilot', rotY: Math.PI / 2 },
    { x: -14.5, z: 45, role: 'staff', rotY: 0 },
  );

  let spotIdx = 0;
  for (let i = 0; i < count; i++) {
    const isSeated = i < gateSeats.length;
    const assignedRole: Role = isSeated ? 'passenger' : (spots[spotIdx % spots.length]?.role ?? 'passenger');
    const p = makePerson(scene, assignedRole, i, i);

    if (isSeated) {
      const [sx, sz] = gateSeats[i];
      p.root.position.set(sx, 0.42, sz);
      p.root.rotation.y = Math.PI;
      p.setWalking?.(false);
    } else {
      const s = spots[spotIdx++ % spots.length];
      p.root.position.set(
        s.x + (Math.random() - 0.5) * 0.3,
        0,
        s.z + (Math.random() - 0.5) * 0.3,
      );
      p.root.rotation.y = s.rotY ?? (Math.random() * Math.PI * 2);

      const w = p as JourneyWalker;
      // Roaming passengers within the terminal
      if (assignedRole === 'passenger' && Math.random() < 0.4 && !s.rotY) {
        w.waypoints = [
          new Vector3(-20 + Math.random() * 36, 0, -16 + Math.random() * 28),
          new Vector3(-20 + Math.random() * 36, 0, -16 + Math.random() * 28),
        ];
        w.wpIndex = 0;
        w.speed = 0.8 + Math.random() * 0.5;
        w.wait = Math.random() * 3;
        w.loop = true;
        p.setWalking?.(true, w.speed);
      } else {
        w.waypoints = [p.root.position.clone()];
        w.wpIndex = 0;
        w.speed = 0;
        w.wait = 1e9;
        w.loop = false;
        p.setWalking?.(false);
      }
      walkers.push(w);
    }
  }

  return {
    update(dt: number, t: number) {
      for (const w of walkers) {
        w.update(dt, t);

        if (w.speed > 0 && w.waypoints && w.waypoints.length > 1) {
          if (w.wait > 0) {
            w.wait -= dt;
            w.setWalking?.(false);
            continue;
          }

          const target = w.waypoints[w.wpIndex];
          const pos = w.root.position;
          const dx = target.x - pos.x;
          const dz = target.z - pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.5) {
            w.wpIndex = (w.wpIndex + 1) % w.waypoints.length;
            if (w.wpIndex === 0 && !w.loop) {
              w.speed = 0;
              w.setWalking?.(false);
            } else {
              w.wait = 1.0 + Math.random() * 2.0;
            }
            continue;
          }

          w.setWalking?.(true, w.speed);
          pos.x += (dx / dist) * w.speed * dt;
          pos.z += (dz / dist) * w.speed * dt;
          w.root.rotation.y = Math.atan2(dx, dz);
        }
      }
    },
    meshes: walkers.map((w) => w.root),
    stats() {
      const zones = [
        { name: 'Parking & Curbside', x0: -35, x1: 35, z0: -65, z1: -22 },
        { name: 'Check-in & Departures', x0: -22, x1: 10, z0: -18, z1: -4 },
        { name: 'Security Checkpoint', x0: -8, x1: 6, z0: -4, z1: 4 },
        { name: 'Departure Gates', x0: -18, x1: 4, z0: 8, z1: 20 },
        { name: 'Immigration & Baggage Claim', x0: 8, x1: 30, z0: -18, z1: 20 },
        { name: 'Apron Stand A12', x0: -20, x1: 20, z0: 30, z1: 60 },
      ];
      return {
        total: count,
        zones: zones.map((z) => ({
          name: z.name,
          count: walkers.filter((w) => {
            const pos = w.root.position;
            return pos.x >= z.x0 && pos.x < z.x1 && pos.z >= z.z0 && pos.z < z.z1;
          }).length + (z.name === 'Departure Gates' ? gateSeats.length : 0),
        })),
      };
    },
  };
}
