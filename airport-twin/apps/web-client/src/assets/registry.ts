import { Color3, Mesh, MeshBuilder, Node, Scene, PBRMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { attachBeacon } from '../twin/status';

export type Status = 'operational' | 'offline' | 'maintenance' | 'warning' | 'critical' | 'unknown';
export interface Vec { x: number; y: number; z: number }
export interface Asset {
  asset_id: string; asset_type: string; name: string; position: Vec; rotation: Vec;
  status: Status; model_path: string; location?: string; last_update?: string; reason?: string;
  metadata?: Record<string, any>;
}

// Scene file = static transforms. Status comes from the Backend only.
export const loadRegistry = async (): Promise<Asset[]> => (await fetch('/twin/assets/registry.json')).json();

function tag(node: Node, asset_id: string) {
  if (node instanceof Mesh) node.metadata = { ...(node.metadata ?? {}), asset_id };
  node.getChildren().forEach((c) => tag(c, asset_id));
}

/** Small detailed markers for assets without a dedicated builder anchor. */
function buildMarker(scene: Scene, a: Asset): TransformNode {
  const G = new TransformNode(a.asset_id, scene);
  const paint = (n: string, c: Color3) => { const m = new PBRMaterial(n, scene); m.albedoColor = c; return m; };
  if (a.asset_type === 'robot') {
    // TEMPORARY visual placeholder until `RB-007.glb` lands (Step 2 GLB plan) —
    // NOT the final design. Status color is owned by the floating beacon added
    // in buildMeshes (backend status only); paint below stays neutral livery.
    const { x, z } = { x: a.position.x, z: a.position.z };
    const add = <T extends Mesh>(m: T): T => { m.parent = G; m.isPickable = false; return m; };
    // Rolling chassis + safety bumper (rep mesh for focus/beacon = this base)
    const base = add(MeshBuilder.CreateBox(a.asset_id, { width: 1.0, height: 0.35, depth: 1.5 }, scene));
    base.position.set(x, 0.38, z);
    base.material = paint('robotBase', new Color3(0.16, 0.17, 0.2)); base.checkCollisions = true;
    const bumperM = paint('robotBumper', new Color3(0.95, 0.7, 0.1));
    for (const dz of [-0.78, 0.78]) {
      const b = add(MeshBuilder.CreateBox(`${a.asset_id}_bumper_${dz}`, { width: 1.02, height: 0.14, depth: 0.08 }, scene));
      b.position.set(x, 0.28, z + dz); b.material = bumperM;
    }
    // Wheels + fenders (forward = +z; patrol steers rotation.y toward travel)
    const tireM = paint('robotTire', new Color3(0.08, 0.08, 0.09));
    const fenderM = paint('robotFender', new Color3(0.25, 0.27, 0.3));
    for (const [dx, dz] of [[-0.5, -0.52], [0.5, -0.52], [-0.5, 0.52], [0.5, 0.52]] as [number, number][]) {
      const wh = add(MeshBuilder.CreateCylinder(`${a.asset_id}_w_${dx}_${dz}`, { height: 0.16, diameter: 0.4, tessellation: 20 }, scene));
      wh.rotation.z = Math.PI / 2; wh.position.set(x + dx, 0.2, z + dz); wh.material = tireM;
      const f = add(MeshBuilder.CreateBox(`${a.asset_id}_f_${dx}_${dz}`, { width: 0.2, height: 0.08, depth: 0.5 }, scene));
      f.position.set(x + dx, 0.44, z + dz); f.material = fenderM;
    }
    // Livery mid-body + open cargo bed with side rails (baggage-carrier role)
    const body = add(MeshBuilder.CreateBox(`${a.asset_id}_body`, { width: 0.85, height: 0.5, depth: 1.2 }, scene));
    body.position.set(x, 0.8, z); body.material = paint('robotLivery', new Color3(0.9, 0.62, 0.08));
    const railM = paint('robotRail', new Color3(0.2, 0.21, 0.24));
    const bed = add(MeshBuilder.CreateBox(`${a.asset_id}_bed`, { width: 0.8, height: 0.06, depth: 0.7 }, scene));
    bed.position.set(x, 1.08, z - 0.2); bed.material = railM;
    for (const [w, h, d, px, py, pz] of [
      [0.8, 0.3, 0.05, x, 1.25, z - 0.53], [0.8, 0.3, 0.05, x, 1.25, z + 0.13],
      [0.05, 0.3, 0.66, x - 0.38, 1.25, z - 0.2], [0.05, 0.3, 0.66, x + 0.38, 1.25, z - 0.2],
    ] as [number, number, number, number, number, number][]) {
      const r = add(MeshBuilder.CreateBox(`${a.asset_id}_rail_${px}_${pz}`, { width: w, height: h, depth: d }, scene));
      r.position.set(px, py, pz); r.material = railM;
    }
    // Visible payload: two strapped suitcases
    const bagA = add(MeshBuilder.CreateBox(`${a.asset_id}_bagA`, { width: 0.5, height: 0.28, depth: 0.35 }, scene));
    bagA.position.set(x - 0.05, 1.25, z - 0.28); bagA.material = paint('robotBagA', new Color3(0.18, 0.38, 0.72));
    const bagB = add(MeshBuilder.CreateBox(`${a.asset_id}_bagB`, { width: 0.4, height: 0.24, depth: 0.3 }, scene));
    bagB.position.set(x + 0.08, 1.23, z - 0.05); bagB.material = paint('robotBagB', new Color3(0.7, 0.2, 0.2));
    // Sensor mast + lidar puck + status eye (forward-facing)
    const mast = add(MeshBuilder.CreateCylinder(`${a.asset_id}_mast`, { height: 0.55, diameter: 0.1, tessellation: 12 }, scene));
    mast.position.set(x, 1.32, z + 0.45); mast.material = paint('robotMast', new Color3(0.5, 0.52, 0.55));
    const lidar = add(MeshBuilder.CreateCylinder(`${a.asset_id}_lidar`, { height: 0.12, diameter: 0.22, tessellation: 16 }, scene));
    lidar.position.set(x, 1.62, z + 0.45); lidar.material = paint('robotLidar', new Color3(0.1, 0.11, 0.13));
    const eye = add(MeshBuilder.CreateSphere(`${a.asset_id}_eye`, { diameter: 0.12, segments: 12 }, scene));
    eye.position.set(x, 1.45, z + 0.52);
    const em = paint('robotEye', new Color3(0.1, 0.4, 1)); em.emissiveColor = new Color3(0.1, 0.4, 1); eye.material = em;
    // Headlights (front) + taillights (rear)
    const hlM = paint('robotHL', new Color3(0.95, 0.95, 0.85)); hlM.emissiveColor = new Color3(0.7, 0.7, 0.55);
    for (const dx of [-0.28, 0.28]) {
      const hl = add(MeshBuilder.CreateBox(`${a.asset_id}_hl_${dx}`, { width: 0.16, height: 0.1, depth: 0.04 }, scene));
      hl.position.set(x + dx, 0.72, z + 0.61); hl.material = hlM;
    }
    const tlM = paint('robotTL', new Color3(0.8, 0.1, 0.1)); tlM.emissiveColor = new Color3(0.6, 0.05, 0.05);
    const tl = add(MeshBuilder.CreateBox(`${a.asset_id}_tl`, { width: 0.5, height: 0.08, depth: 0.04 }, scene));
    tl.position.set(x, 0.72, z - 0.61); tl.material = tlM;
  } else {
    // sensor: pedestal + glass dome
    const ped = MeshBuilder.CreateCylinder(a.asset_id, { height: 1.0, diameter: 0.25 }, scene);
    ped.parent = G; ped.position.set(a.position.x, 0.5, a.position.z);
    ped.material = paint('senM', new Color3(0.4, 0.42, 0.45)); ped.checkCollisions = true;
    const dome = MeshBuilder.CreateSphere(`${a.asset_id}_dome`, { diameter: 0.3 }, scene);
    dome.parent = G; dome.position.set(a.position.x, 1.15, a.position.z);
    const dm = paint('senD', new Color3(0.2, 0.5, 0.9)); dm.emissiveColor = new Color3(0.1, 0.25, 0.5); dome.material = dm;
  }
  return G;
}

/**
 * The mesh is not the asset: Map<asset_id, anchor> keeps the stable ID.
 * Returns representative mesh per asset (for camera focus) + status beacons.
 */
export function buildMeshes(
  scene: Scene, assets: Asset[], anchors: Map<string, TransformNode>,
): { map: Map<string, Mesh>; beacons: Map<string, Mesh>; focusOf(id: string): Vector3 } {
  const map = new Map<string, Mesh>();
  const beacons = new Map<string, Mesh>();
  for (const a of assets) {
    let anchor = anchors.get(a.asset_id);
    if (!anchor) {
      const marker = buildMarker(scene, a);
      anchors.set(a.asset_id, marker);
      anchor = marker;
    }
    tag(anchor, a.asset_id);
    // representative mesh: first real Mesh under anchor, else invisible proxy at registry pos
    let rep = anchor.getChildMeshes(false)[0] as Mesh | undefined;
    if (!rep) {
      rep = MeshBuilder.CreateBox(a.asset_id, { size: 0.5 }, scene);
      rep.isVisible = false; rep.parent = anchor;
      rep.position.set(a.position.x, (a.position.y ?? 0) + 1, a.position.z);
    }
    map.set(a.asset_id, rep);
    rep.computeWorldMatrix(true);
    beacons.set(a.asset_id, attachBeacon(rep as Mesh, a.status));
  }
  const focusOf = (id: string) => {
    const m = map.get(id);
    if (!m) return Vector3.Zero();
    m.computeWorldMatrix(true);
    return m.getBoundingInfo().boundingBox.centerWorld.clone();
  };
  return { map, beacons, focusOf };
}
