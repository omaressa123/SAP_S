import { Scene, TransformNode, Vector3 } from '@babylonjs/core';
import type { Cameras, ViewMode } from '../camera/cameras';
import { startFollow, stopFollow } from '../camera/cameras';

export function setView(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras, mode: ViewMode) {
  if (mode !== 'tp') stopFollow(scene, canvas, cams);
  scene.activeCamera?.detachControl();
  scene.activeCamera = cams[mode];
  cams[mode].attachControl(canvas, true);
}

/** Teleport walker: stand in front of target and look at it at human eye height. */
export function teleportTo(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras, p: Vector3) {
  setView(scene, canvas, cams, 'fp');
  cams.fp.position.set(p.x, Math.max(1.7, p.y + 1.2), p.z - 4);
  cams.fp.setTarget(new Vector3(p.x, Math.max(1.2, p.y + 0.8), p.z));
}

/**
 * Third-person follow. Live target (TransformNode) => per-frame chase rig
 * with collision (Step 3); static Vector3 => one-shot framing (legacy).
 */
export function followAt(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras, p: Vector3 | TransformNode) {
  setView(scene, canvas, cams, 'tp');
  if (p instanceof TransformNode) {
    startFollow(scene, canvas, cams, p);
    return;
  }
  stopFollow(scene, canvas, cams);
  cams.tp.position.set(p.x, 3.0, p.z - 7.5);
  cams.tp.setTarget(new Vector3(p.x, 1.8, p.z + 4.0));
}

export function locateOnMap(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras, p: Vector3) {
  setView(scene, canvas, cams, 'ov');
  cams.ov.target = p.clone();
  cams.ov.radius = 36;
}

export interface Place {
  name: string;
  at: [number, number, number];
  look: [number, number, number];
}

/**
 * End-to-End Complete Passenger Journey Viewpoints (18 Intentional Stops):
 * DEPARTURES: Road ➔ Vehicle ➔ Parking ➔ Walkway ➔ Terminal Entrance ➔ Check-In ➔ Bag Drop ➔ Security ➔ Departure Hall ➔ FIDS ➔ Gate A12 ➔ Jet Bridge ➔ Aircraft
 * ARRIVALS: Deplaning ➔ Passport Control ➔ Baggage Claim ➔ Customs ➔ Pick-Up Exit
 */
export const PLACES: Place[] = [
  // 1. Exterior Overview
  { name: '1. Airport Exterior Overview', at: [-32, 28, -62], look: [0, 4, -10] },
  // 2. Vehicle Entering Airport
  { name: '2. Vehicle Entering Airport', at: [-28, 3.2, -45], look: [-10, 1.8, -41] },
  // 3. Parking Facility P1
  { name: '3. Parking Facility P1', at: [-14, 2.4, -64], look: [-8, 1.5, -55] },
  // 4. Passenger Walkway to Terminal
  { name: '4. Walkway to Terminal', at: [0, 1.7, -46], look: [0, 2.2, -24] },
  // 5. Terminal Main Entrance
  { name: '5. Terminal Main Entrance', at: [0, 1.7, -27], look: [0, 2.6, -19] },
  // 6. Check-In & Bag Drop (stands 1.0m+ clear of the FIDS-001 box edge)
  { name: '6. Check-In & Bag Drop', at: [-9, 1.7, -12.8], look: [-12, 1.5, -6] },
  // 7. Baggage Sorting Conveyor
  { name: '7. Baggage Intake Belt', at: [-14, 1.5, -11], look: [-14, 0.8, -6] },
  // 8. Security Screening Checkpoint
  { name: '8. Security Screening', at: [-1, 1.7, -3.5], look: [-1, 1.6, 2.5] },
  // 9. Departure Concourse Hall
  { name: '9. Departure Concourse Hall', at: [-4, 1.7, 5], look: [-4, 2.0, 14] },
  // 10. Flight Info Board (FIDS)
  { name: '10. Flight Info Board (FIDS)', at: [-5, 1.7, -15], look: [-5, 3.2, -12] },
  // 11. Boarding Gate A12
  { name: '11. Boarding Gate A12', at: [-8, 1.7, 10], look: [-8, 1.8, 16] },
  // 12. Jet Bridge Walkway
  { name: '12. Jet Bridge Walkway', at: [-8, 1.7, 26], look: [-8, 1.9, 41] },
  // 13. Aircraft & Stand A12 (1.5m+ clear of the nearest safety cone)
  { name: '13. Aircraft & Stand A12', at: [15, 1.7, 35.5], look: [0, 2.8, 45] },
  // 14. Arrivals Concourse
  { name: '14. Arrivals Concourse', at: [22, 1.7, 16], look: [24, 1.6, 10] },
  // 15. Passport & Immigration Control
  { name: '15. Passport Control', at: [23, 1.7, 13], look: [26, 1.6, 13] },
  // 16. Baggage Reclaim Carousels
  { name: '16. Baggage Reclaim Carousel', at: [8, 1.7, -8.2], look: [13, 1.2, -8.2] },
  // 17. Customs Inspection Area
  { name: '17. Customs Green/Red Channel', at: [20, 1.7, -12], look: [20, 1.6, -17.5] },
  // 18. Arrivals Exit & Pick-Up
  { name: '18. Arrivals Exit & Pick-Up', at: [18, 1.7, -23], look: [18, 1.6, -28] },
];

export function teleportToPlace(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras, p: Place) {
  setView(scene, canvas, cams, 'fp');
  cams.fp.position.set(...p.at);
  cams.fp.setTarget(new Vector3(...p.look));
}

/** Aircraft inspection and detail camera presets */
export const AIRCRAFT_VIEWS: { name: string; pos: [number, number, number]; tgt: [number, number, number] }[] = [
  { name: 'Front Quarter', pos: [24, 4.8, 30], tgt: [2, 2.8, 45] },
  { name: 'Engine Detail', pos: [4.8, 1.8, 35.5], tgt: [1.2, 1.4, 38.5] },
  { name: 'Cockpit Glass', pos: [18.8, 3.8, 41.5], tgt: [15.8, 3.2, 45.0] },
  { name: 'Rear / Tail', pos: [-28, 6.5, 45], tgt: [-5, 3.0, 45] },
  { name: 'Jet Bridge / L2', pos: [-9.5, 3.2, 26], tgt: [-8.0, 2.6, 42] },
  { name: 'Right / Catering', pos: [0, 4.0, 66], tgt: [0, 2.8, 45] },
  { name: 'Underbody / Gear', pos: [-2, 0.8, 37.5], tgt: [-0.5, 1.2, 45] },
  { name: 'Interior Cabin', pos: [-4, 2.75, 45], tgt: [8, 2.2, 45] },
];
