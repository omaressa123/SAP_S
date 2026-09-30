import { Mesh, MeshBuilder, Scene, PBRMaterial, Color3, Vector3 } from '@babylonjs/core';

/** Fallback routes ([x, z], meters), used only while the backend is offline. Live positions come from the backend. */
export const ROUTES: Record<string, [number, number][]> = {
  'RB-007': [[4.2, 12.4], [12, 12.4], [12, -2], [4.2, -2]],
};

/** Offline fallback: walk the route at `speed` m/s while canMove(). */
export function patrol(scene: Scene, mesh: Mesh, route: Vector3[], speed: number, canMove: () => boolean) {
  let i = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (!canMove()) return;
    const t = route[i], p = mesh.position, d = new Vector3(t.x - p.x, 0, t.z - p.z), dist = d.length();
    const step = (speed * scene.getEngine().getDeltaTime()) / 1000;
    if (dist <= step) { p.x = t.x; p.z = t.z; i = (i + 1) % route.length; return; }
    d.scaleInPlace(step / dist); p.addInPlace(d); mesh.rotation.y = Math.atan2(d.x, d.z);
  });
}

/** Live mode: the backend (robot controller) sends positions ~4x/s; the mesh eases toward them. */
export function followPose(scene: Scene, mesh: Mesh) {
  let tx: number | null = null, tz = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (tx === null) return;
    const dx = tx - mesh.position.x, dz = tz - mesh.position.z;
    if (Math.hypot(dx, dz) > 0.02) mesh.rotation.y = Math.atan2(dx, dz);
    mesh.position.x += dx * 0.2; mesh.position.z += dz * 0.2;
  });
  return (x: number, z: number) => { tx = x; tz = z; };
}

export const BUSY = 12;
export interface CrowdStats { total: number; zones: { name: string; count: number }[] }
const ZONES = [{ name: 'Security', x0: -30, x1: -16 }, { name: 'Concourse', x0: -16, x1: -2 }, { name: 'Gates', x0: -2, x1: 10 }];
const A = { x0: -28, x1: 9, z0: -18, z1: 18 };
const OBSTACLES = [ // columns + boarding gate (circles: x, z, radius incl. body margin)
  ...[-20, -10, 0, 10, 20].flatMap((x) => [-8, 8].map((z) => ({ x, z, r: 0.9 }))),
  ...[-11.2, -10, -8.8].map((x) => ({ x, z: 10, r: 0.9 })),
];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = () => {
  let x: number, z: number;
  do { x = rand(A.x0, A.x1); z = rand(A.z0, A.z1); } while (OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.6));
  return { x, z };
};

/** Crowd with steering: go to a target, but get pushed (and slid sideways) around columns, gate, robots and each other. */
export function startPassengers(scene: Scene, n: number, onStats: (s: CrowdStats) => void, dynamic: Mesh[] = []) {
  const base = MeshBuilder.CreateCapsule('pax', { height: 1.7, radius: 0.25 }, scene);
  const mat = new PBRMaterial('paxMat', scene); mat.albedoColor = new Color3(0.4, 0.6, 0.95);
  base.material = mat; base.isVisible = false; base.isPickable = false;
  const pax = Array.from({ length: n }, (_, k) => {
    const m = base.createInstance(`pax_${k}`); m.isPickable = false;
    const s = pick(); m.position.set(s.x, 0.85, s.z);
    return { m, ...pick(), v: rand(0.8, 1.4), wait: 0 };
  });
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
    for (const p of pax) {
      if (p.wait > 0) { p.wait -= dt; continue; }
      const px = p.m.position.x, pz = p.m.position.z, dx = p.x - px, dz = p.z - pz, dist = Math.hypot(dx, dz);
      if (dist < 0.6) { Object.assign(p, pick()); p.wait = rand(0, 3); continue; }
      let vx = dx / dist, vz = dz / dist;
      const push = (ox: number, oz: number, r: number, k: number) => {
        const ex = px - ox, ez = pz - oz, d = Math.hypot(ex, ez), reach = r + 0.8;
        if (d >= reach || d < 1e-3) return;
        const w = ((reach - d) / 0.8) * k, nx = ex / d, nz = ez / d;
        let sx = -nz, sz = nx; if (sx * vx + sz * vz < 0) { sx = -sx; sz = -sz; } // slide the way we were heading
        vx += (nx + sx) * w; vz += (nz + sz) * w;
      };
      OBSTACLES.forEach((o) => push(o.x, o.z, o.r, 2));
      dynamic.forEach((m) => push(m.position.x, m.position.z, 0.6, 2));
      pax.forEach((q) => q !== p && push(q.m.position.x, q.m.position.z, 0.4, 1));
      const l = Math.hypot(vx, vz) || 1;
      p.m.position.x = Math.min(A.x1, Math.max(A.x0, px + (vx / l) * p.v * dt));
      p.m.position.z = Math.min(A.z1, Math.max(A.z0, pz + (vz / l) * p.v * dt));
      p.m.rotation.y = Math.atan2(vx, vz);
    }
  });
  const id = setInterval(() => onStats({ total: n, zones: ZONES.map((z) => ({
    name: z.name, count: pax.filter((p) => p.m.position.x >= z.x0 && p.m.position.x < z.x1).length })) }), 1000);
  return () => clearInterval(id);
}
