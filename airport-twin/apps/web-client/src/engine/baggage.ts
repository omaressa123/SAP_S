import { Color3, Mesh, MeshBuilder, Scene, PBRMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { Mats } from './materials';

export interface LuggageItem {
  root: TransformNode;
  beltType: 'checkin' | 'carousel1' | 'carousel2';
  progress: number; // 0 to 1 along path
  speed: number;
}

export interface BaggageSystem {
  update(dt: number, t: number): void;
  items: LuggageItem[];
}

const LUGGAGE_COLORS = [
  new Color3(0.12, 0.14, 0.18), // Midnight Black
  new Color3(0.12, 0.28, 0.58), // Aviation Navy
  new Color3(0.68, 0.15, 0.18), // Burgundy Hardcase
  new Color3(0.22, 0.52, 0.32), // Forest Green
  new Color3(0.78, 0.62, 0.18), // Mustard Yellow
  new Color3(0.55, 0.58, 0.62), // Metallic Silver
  new Color3(0.42, 0.25, 0.15), // Leather Brown
];

/**
 * Creates an authentic, realistic 3D suitcase:
 * Contoured hardshell body, protective corner bumpers, top handle,
 * telescopic trolley handle poles & grip, 4 spinner wheels, zipper seam, and luggage tag.
 */
export function makeSuitcase(
  scene: Scene,
  colorIdx = 0,
  scale = 1.0,
  parent?: TransformNode,
): TransformNode {
  const root = new TransformNode(`suitcase_${Math.floor(Math.random() * 1e6)}`, scene);
  if (parent) root.parent = parent;

  const bodyMat = new PBRMaterial('suitBodyMat', scene);
  bodyMat.albedoColor = LUGGAGE_COLORS[colorIdx % LUGGAGE_COLORS.length];

  const darkTrimMat = new PBRMaterial('suitTrimMat', scene);
  darkTrimMat.albedoColor = new Color3(0.08, 0.09, 0.1);

  const silverMat = new PBRMaterial('suitSilverMat', scene);
  silverMat.albedoColor = new Color3(0.85, 0.88, 0.92);

  const w = 0.42 * scale;
  const h = 0.62 * scale;
  const d = 0.26 * scale;

  // Main Hardshell Suitcase Body
  const body = MeshBuilder.CreateBox('suitBody', { width: w, height: h, depth: d }, scene);
  body.parent = root;
  body.position.y = h / 2 + 0.05 * scale;
  body.material = bodyMat;
  body.isPickable = false;

  // Zipper Expansion Seam
  const zipper = MeshBuilder.CreateBox('zipper', { width: w + 0.01 * scale, height: h + 0.01 * scale, depth: 0.03 * scale }, scene);
  zipper.parent = root;
  zipper.position.y = body.position.y;
  zipper.material = darkTrimMat;
  zipper.isPickable = false;

  // 4 Spinner Wheels
  for (const dx of [-w / 2 + 0.05 * scale, w / 2 - 0.05 * scale]) {
    for (const dz of [-d / 2 + 0.05 * scale, d / 2 - 0.05 * scale]) {
      const wh = MeshBuilder.CreateCylinder('sWheel', { height: 0.03 * scale, diameter: 0.06 * scale, tessellation: 12 }, scene);
      wh.parent = root;
      wh.rotation.z = Math.PI / 2;
      wh.position.set(dx, 0.03 * scale, dz);
      wh.material = darkTrimMat;
      wh.isPickable = false;
    }
  }

  // Top Carry Handle
  const topHandle = MeshBuilder.CreateBox('topHandle', { width: 0.14 * scale, height: 0.03 * scale, depth: 0.04 * scale }, scene);
  topHandle.parent = root;
  topHandle.position.set(0, h + 0.07 * scale, 0);
  topHandle.material = darkTrimMat;
  topHandle.isPickable = false;

  // Luggage Destination Tag
  const tag = MeshBuilder.CreatePlane('tag', { width: 0.08 * scale, height: 0.12 * scale }, scene);
  tag.parent = root;
  tag.position.set(0.08 * scale, h + 0.02 * scale, d / 2 + 0.01 * scale);
  const tagMat = new PBRMaterial('tagMat', scene);
  tagMat.albedoColor = new Color3(0.95, 0.95, 0.9);
  tag.material = tagMat;
  tag.isPickable = false;

  return root;
}

/**
 * Builds the animated baggage handling system:
 * 1. Check-In & Bag Drop Intake belts (feeding behind walls).
 * 2. Baggage Reclaim Racetrack Carousels (circulating luggage around CONV-001 & CONV-002).
 */
export function buildBaggageSystem(scene: Scene, mats: Mats, worldNode: TransformNode): BaggageSystem {
  const items: LuggageItem[] = [];

  // 1. Check-in Desk Bag Drop Moving Conveyor Luggage
  const checkinDropFeeds = [
    { x: -14, startZ: -9.5, endZ: -5.5 },
    { x: -10, startZ: -9.5, endZ: -5.5 },
    { x: 0, startZ: -9.5, endZ: -5.5 },
    { x: 4, startZ: -9.5, endZ: -5.5 },
  ];

  checkinDropFeeds.forEach((feed, i) => {
    const suit = makeSuitcase(scene, i * 2, 0.9, worldNode);
    suit.rotation.x = Math.PI / 2; // Flat on conveyor bed
    suit.position.set(feed.x, 0.44, feed.startZ);

    items.push({
      root: suit,
      beltType: 'checkin',
      progress: (i * 0.25) % 1.0,
      speed: 0.15,
    });
  });

  // 2. Baggage Claim Carousel 1 & 2 Circulating Luggage Racetracks
  // Racetrack dimensions: center at (12.5, z), length = 8.0m (X: 8.5 to 16.5), width = 2.4m (Z: z-1.2 to z+1.2)
  const createCarouselLoop = (carouselId: 'carousel1' | 'carousel2', centerZ: number, count = 10) => {
    const cx = 12.5;
    const cz = centerZ;
    const halfL = 3.6; // straight segment half length
    const halfW = 1.0; // radius of end turn

    for (let i = 0; i < count; i++) {
      const suit = makeSuitcase(scene, i + (carouselId === 'carousel2' ? 5 : 0), 0.85 + (i % 3) * 0.1, worldNode);
      // Flat or tilted upright on the slatted carousel
      if (i % 2 === 0) {
        suit.rotation.x = Math.PI / 2;
        suit.rotation.z = Math.PI / 2;
      } else {
        suit.rotation.x = 0.2;
      }

      items.push({
        root: suit,
        beltType: carouselId,
        progress: i / count,
        speed: 0.08,
      });
    }
  };

  createCarouselLoop('carousel1', -8.2, 10);
  createCarouselLoop('carousel2', -14.2, 10);

  // Path Evaluator for Carousel Racetrack Loop
  const evaluateCarouselPath = (progress: number, cz: number): { x: number; z: number; rotY: number } => {
    // 4 sections of racetrack:
    // 0.0 - 0.35: Bottom straight (X from 16.1 down to 8.9 at Z = cz - 0.9)
    // 0.35 - 0.50: Left curve around (X = 8.9 to 8.9, sweeping around X=8.9, Z=cz)
    // 0.50 - 0.85: Top straight (X from 8.9 up to 16.1 at Z = cz + 0.9)
    // 0.85 - 1.00: Right curve around (X = 16.1, sweeping around X=16.1, Z=cz)
    const p = ((progress % 1.0) + 1.0) % 1.0;
    const cxL = 9.0;
    const cxR = 16.0;
    const r = 0.9;

    if (p < 0.35) {
      // Bottom straight (moving left / -X)
      const t = p / 0.35;
      const x = cxR - t * (cxR - cxL);
      return { x, z: cz - r, rotY: -Math.PI / 2 };
    } else if (p < 0.5) {
      // Left turnaround curve (sweeping from bottom to top)
      const t = (p - 0.35) / 0.15;
      const angle = -Math.PI / 2 + t * Math.PI;
      const x = cxL - Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r;
      return { x, z, rotY: -angle - Math.PI / 2 };
    } else if (p < 0.85) {
      // Top straight (moving right / +X)
      const t = (p - 0.5) / 0.35;
      const x = cxL + t * (cxR - cxL);
      return { x, z: cz + r, rotY: Math.PI / 2 };
    } else {
      // Right turnaround curve inside discharge hood (sweeping top to bottom)
      const t = (p - 0.85) / 0.15;
      const angle = Math.PI / 2 + t * Math.PI;
      const x = cxR + Math.cos(angle - Math.PI) * r;
      const z = cz + Math.sin(angle) * r;
      return { x, z, rotY: -angle + Math.PI / 2 };
    }
  };

  return {
    update(dt: number, t: number) {
      for (const item of items) {
        item.progress = (item.progress + item.speed * dt) % 1.0;

        if (item.beltType === 'checkin') {
          // Checkin drop conveyor: advances +Z towards wall opening
          const startZ = -9.2;
          const endZ = -5.0;
          const z = startZ + item.progress * (endZ - startZ);
          item.root.position.z = z;
          item.root.position.y = 0.44;
        } else if (item.beltType === 'carousel1') {
          const pt = evaluateCarouselPath(item.progress, -8.2);
          item.root.position.x = pt.x;
          item.root.position.z = pt.z;
          item.root.position.y = 0.76;
          item.root.rotation.y = pt.rotY;
        } else if (item.beltType === 'carousel2') {
          const pt = evaluateCarouselPath(item.progress, -14.2);
          item.root.position.x = pt.x;
          item.root.position.z = pt.z;
          item.root.position.y = 0.76;
          item.root.rotation.y = pt.rotY;
        }
      }
    },
    items,
  };
}
