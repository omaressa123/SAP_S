import { ArcRotateCamera, Mesh, Ray, Scene, TransformNode, UniversalCamera, Vector3 } from '@babylonjs/core';

export function createCameras(scene: Scene, canvas: HTMLCanvasElement) {
  // 1. First-person walker: WASD/arrows, mouse look, realistic human eye-height, collisions, sprint
  const fp = new UniversalCamera('fp', new Vector3(0, 1.7, -27), scene);
  fp.setTarget(new Vector3(0, 2.5, -19));
  fp.keysUp = [87, 38];
  fp.keysDown = [83, 40];
  fp.keysLeft = [65, 37];
  fp.keysRight = [68, 39];
  fp.speed = 0.25;
  fp.angularSensibility = 2400;
  fp.fov = 1.35; // ~77° — realistic walking FOV (Step 1 realism pass)
  fp.minZ = 0.15; // ≥0.1: avoids near-plane slicing when close to a surface
  fp.maxZ = 800;
  fp.checkCollisions = true;
  fp.applyGravity = true;
  fp.ellipsoid = new Vector3(0.35, 0.85, 0.35);

  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    if (e.key === 'Shift') fp.speed = down ? 0.65 : 0.25;
  };
  addEventListener('keydown', onKey(true));
  addEventListener('keyup', onKey(false));

  // 2. Third-person follow rig (offset follow target wired in Step 3)
  const tp = new UniversalCamera('tp', new Vector3(0, 3.2, -32), scene);
  tp.setTarget(new Vector3(0, 2.0, -19));
  tp.fov = 1.3; // ~74° — matches FP feel
  tp.minZ = 0.15;
  tp.maxZ = 800;
  tp.checkCollisions = true;
  tp.applyGravity = true;
  tp.ellipsoid = new Vector3(0.35, 0.85, 0.35);

  // 3. Free inspect camera (Orbit around scene / assets)
  const free = new ArcRotateCamera('free', -Math.PI / 2.3, 1.15, 55, new Vector3(0, 2.5, 40), scene);
  free.lowerRadiusLimit = 2.0; // keep close inspection outside the skin
  free.upperRadiusLimit = 400;
  free.wheelPrecision = 16;
  free.minZ = 0.15;
  free.maxZ = 800;

  // 4. Overview: Whole Airport Isometric / Aerial View
  const ov = new ArcRotateCamera('ov', -Math.PI / 2.2, 0.42, 175, new Vector3(0, 0, 20), scene);
  ov.lowerRadiusLimit = 10;
  ov.upperRadiusLimit = 500;
  ov.wheelPrecision = 14;
  ov.minZ = 0.15;
  ov.maxZ = 1200;

  scene.activeCamera = fp;
  fp.attachControl(canvas, true);
  return { fp, tp, free, ov };
}

export type Cameras = ReturnType<typeof createCameras>;
export type ViewMode = 'fp' | 'tp' | 'free' | 'ov';

// ---------------------------------------------------------------------------
// Step 3 — Third-person follow rig: fixed distance/angle chase cam with
// smoothing, drag-orbit + wheel zoom, and raycast collision so the camera
// never clips through walls, columns or the aircraft.
// ---------------------------------------------------------------------------

interface FollowState {
  target: TransformNode;
  yaw: number; // radians, absolute: init behind the target's heading
  pitch: number; // radians above horizontal
  dist: number; // meters, wheel-adjustable 3..12
}

let follow: FollowState | null = null;
let orbitCleanup: (() => void) | null = null;
const colliderCache = new WeakMap<Scene, Set<Mesh>>();
const lookSmoothed = new Vector3();

const NON_COLLIDER = /person_|people|crowd|luggage|lugWheel|bagBody|backpack|phone|wand|hPole|hBar|plate_|fids_|textPlate|beacon|blobShadow|CONTACT|cs_|ao_|eye|pupil|mouth|nose|hair|muff|visor|badge|ep_|str|stripes|tie|shirt/i;

/** Structural colliders only: checkCollisions meshes big enough to matter. */
function collidersFor(scene: Scene): Set<Mesh> {
  let set = colliderCache.get(scene);
  if (set) return set;
  set = new Set<Mesh>();
  for (const m of scene.meshes) {
    if (!(m instanceof Mesh) || !m.checkCollisions || NON_COLLIDER.test(m.name)) continue;
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    if (bb.maximumWorld.subtract(bb.minimumWorld).length() < 1.2) continue;
    set.add(m);
  }
  colliderCache.set(scene, set);
  return set;
}

export function isFollowing(): boolean {
  return follow !== null;
}

/** Look point derived from the target's world bounds (top of the bounding box),
 *  never from position+fixed offset — position can sit INSIDE the mesh
 *  (e.g. fuselage center), which used to park the chase camera in solid geometry. */
function targetHead(target: TransformNode): Vector3 {
  let min: Vector3 | null = null;
  let max: Vector3 | null = null;
  const meshes: Mesh[] = target instanceof Mesh ? [target] : (target.getChildMeshes(false) as Mesh[]);
  for (const m of meshes) {
    if (m.isVisible === false) continue;
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone();
    max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone();
  }
  if (min && max) {
    const c = min.add(max).scale(0.5);
    return new Vector3(c.x, max.y + 0.3, c.z);
  }
  return target.position.add(new Vector3(0, 1.55, 0));
}

export function stopFollow(scene: Scene, canvas: HTMLCanvasElement, cams: Cameras): void {
  follow = null;
  orbitCleanup?.();
  orbitCleanup = null;
  // Restore free-walk behavior for the TP camera when not following.
  cams.tp.checkCollisions = true;
  cams.tp.applyGravity = true;
  void scene;
  void canvas;
}

export function startFollow(
  scene: Scene,
  canvas: HTMLCanvasElement,
  cams: Cameras,
  target: TransformNode,
  opts: { yaw?: number; pitch?: number; dist?: number } = {},
): void {
  const heading = target.rotation.y;
  follow = {
    target,
    yaw: opts.yaw ?? heading + Math.PI,
    pitch: opts.pitch ?? 0.32,
    dist: opts.dist ?? 5.5,
  };
  // The rig drives the camera itself; engine collisions/gravity would fight it.
  cams.tp.checkCollisions = false;
  cams.tp.applyGravity = false;
  target.computeWorldMatrix(true);
  lookSmoothed.copyFrom(targetHead(target));

  // Drag to orbit, wheel to zoom. Detached on stopFollow / view change.
  let dragging = false;
  let lx = 0;
  let ly = 0;
  const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
  const move = (e: PointerEvent) => {
    if (!dragging || !follow) return;
    follow.yaw -= (e.clientX - lx) * 0.005;
    follow.pitch = Math.max(-0.2, Math.min(1.2, follow.pitch + (e.clientY - ly) * 0.004));
    lx = e.clientX;
    ly = e.clientY;
  };
  const up = () => { dragging = false; };
  const wheel = (e: WheelEvent) => {
    if (!follow || scene.activeCamera !== cams.tp) return;
    e.preventDefault();
    follow.dist = Math.max(3, Math.min(12, follow.dist + Math.sign(e.deltaY) * 0.6));
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  orbitCleanup?.();
  orbitCleanup = () => {
    canvas.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    canvas.removeEventListener('wheel', wheel);
  };
  void scene;
}

/** Per-frame chase update; call from the render loop. No-op unless following. */
export function updateFollowCamera(scene: Scene, cams: Cameras, dt: number): void {
  if (!follow || scene.activeCamera !== cams.tp) return;
  const tp = cams.tp;
  follow.target.computeWorldMatrix(true);
  // Rotation-aware head: recomputed from live bounds every frame, so a turning
  // target (aircraft/passenger/robot) can never leave the camera inside its body.
  const head = targetHead(follow.target);

  // Desired position on the yaw/pitch orbit shell around the target's head.
  const cp = Math.cos(follow.pitch);
  const dir = new Vector3(Math.sin(follow.yaw) * cp, Math.sin(follow.pitch), Math.cos(follow.yaw) * cp);
  let dist = follow.dist;

  // Camera collision: pull in front of the first structural hit.
  const colliders = collidersFor(scene);
  if (colliders.size > 0) {
    const ray = new Ray(head, dir, dist);
    const hit = scene.pickWithRay(ray, (m) => colliders.has(m as Mesh));
    if (hit?.hit && hit.distance < dist) {
      dist = Math.max(0.6, hit.distance - 0.3);
    }
  }
  const desired = head.add(dir.scale(dist));

  // Critically-damped-ish smoothing: position trails, look leads slightly.
  const k = 1 - Math.exp(-dt * 6);
  tp.position.copyFrom(tp.position.clone().add(desired.subtract(tp.position).scale(k)));
  lookSmoothed.copyFrom(lookSmoothed.add(head.subtract(lookSmoothed).scale(1 - Math.exp(-dt * 10))));
  tp.setTarget(lookSmoothed);
}
