import { Mesh, Scene, ShadowGenerator, TransformNode } from '@babylonjs/core';
import { fidsTexture } from './materials';
import { loadModelAsync, modelLoadTracker } from './modelLoader';

/**
 * Step 2 — swap primitive fallbacks for real GLB models.
 *
 * Architecture is preserved: every swap happens INSIDE the stable asset_id
 * anchor, so Mesh-is-not-the-Asset holds and the Registry/UI keep working.
 * Fallback meshes are disposed only after their GLB loads successfully —
 * a failed load keeps the primitive scene intact.
 */

const NO_SHADOW = /Screen|LedStrip|WinR|WinL|winlit/i;

function disposeMatching(anchor: TransformNode, pattern: RegExp): void {
  anchor.getChildMeshes(false).forEach((m) => {
    if (pattern.test(m.name)) m.dispose();
  });
}

function paintScreens(loadedParent: TransformNode, material: unknown): void {
  loadedParent.getChildMeshes(false).forEach((m) => {
    if (/Screen(Front|Back)/.test(m.name)) m.material = material as never;
  });
}

/** Sync part: create anchors for brand-new GLB-only assets (before buildMeshes). */
export function prepareRealModelAnchors(scene: Scene, anchors: Map<string, TransformNode>): void {
  const specs: [string, number, number, number][] = [
    ['SEATING-A01', -14, 0, 13],
    ['SEATING-A02', -8, 0, 13],
    ['SEATING-A03', -2, 0, 13],
    ['PAX-QUEUE-01', -12, 0, -8],
  ];
  for (const [id, x, y, z] of specs) {
    if (anchors.has(id)) continue;
    const t = new TransformNode(id, scene);
    t.position.set(x, y, z);
    anchors.set(id, t);
  }
}

async function upgradeSecurity(scene: Scene, anchors: Map<string, TransformNode>, shadow: ShadowGenerator): Promise<void> {
  for (const [id, x] of [['SECURITY-001', -4], ['SECURITY-002', 2]] as [string, number][]) {
    const anchor = anchors.get(id);
    if (!anchor) continue;
    const meshes = await loadModelAsync(scene, {
      modelPath: 'glb:security_gate.glb',
      parent: anchor,
      position: [x, 0, -0.6],
      assetId: id,
      shadow,
      excludeShadow: NO_SHADOW,
      label: `security gate ${id}`,
    });
    if (meshes.length > 0) disposeMatching(anchor, /^(archL|archR|archT|archLedGreen)$/);
  }
}

async function upgradeFids(scene: Scene, anchors: Map<string, TransformNode>, shadow: ShadowGenerator): Promise<void> {
  // Row content mirrors terminal.ts until the live flights table lands.
  const specs = [
    {
      id: 'FIDS-001', pos: [-5, 3.4, -12] as [number, number, number], hide: /^fidsArray$/,
      title: 'DEPARTURES',
      rows: [
        ['MS123', 'CAIRO / TERMINAL 3', '18:40', 'A12', 'BOARDING'],
        ['EK456', 'DUBAI / DXB', '19:15', 'A02', 'ON TIME'],
        ['BA789', 'LONDON HEATHROW', '20:05', 'A03', 'ON TIME'],
        ['SV321', 'JEDDAH / JED', '21:00', 'A04', 'ON TIME'],
        ['AF552', 'PARIS CDG', '21:45', 'A05', 'DELAYED'],
      ],
    },
    {
      id: 'FIDS-002', pos: [-8, 3.6, 8] as [number, number, number], hide: /^fidsAirsideBox$/,
      title: 'GATES STATUS',
      rows: [
        ['MS123', 'CAIRO / CAI', '18:40', 'A12', 'BOARDING'],
        ['EK456', 'DUBAI / DXB', '19:15', 'A02', 'FINAL CALL'],
        ['BA789', 'LONDON / LHR', '20:05', 'A03', 'ON TIME'],
      ],
    },
  ];
  for (const s of specs) {
    const anchor = anchors.get(s.id);
    if (!anchor) continue;
    const meshes = await loadModelAsync(scene, {
      modelPath: 'glb:fids_board.glb',
      parent: anchor,
      position: s.pos,
      assetId: s.id,
      shadow,
      excludeShadow: NO_SHADOW,
      label: `FIDS board ${s.id}`,
    });
    if (meshes.length > 0) {
      disposeMatching(anchor, s.hide);
      paintScreens(anchor, fidsTexture(scene, s.title, s.rows));
    }
  }
}

/** Load the chair once, then GPU-instance it into the 3 gate seating grids. */
async function upgradeSeating(scene: Scene, anchors: Map<string, TransformNode>, shadow: ShadowGenerator): Promise<void> {
  const staging = anchors.get('SEATING-A01');
  if (!staging) return;
  const template = await loadModelAsync(scene, {
    modelPath: 'glb:chair.glb',
    parent: staging,
    position: [0, -10, 0],
    assetId: 'SEATING-A01',
    shadow: null, // instances register their own shadows below
    label: 'waiting chair (template)',
  });
  if (template.length === 0) return;
  const parts = template.filter((m): m is Mesh => m instanceof Mesh);
  parts.forEach((m) => { m.isVisible = false; });
  const shadowList = shadow.getShadowMap()?.renderList;
  for (const gid of ['SEATING-A01', 'SEATING-A02', 'SEATING-A03']) {
    const anchor = anchors.get(gid);
    if (!anchor) continue;
    for (let r = 0; r < 2; r++) {
      for (let s = 0; s < 5; s++) {
        const dx = -3.2 + s * 1.6;
        const dz = -0.8 + r * 1.5;
        for (const part of parts) {
          const inst = part.createInstance(`${gid}_chair_${r}_${s}_${part.name}`);
          inst.parent = anchor;
          inst.position.set(dx, 0, dz);
          inst.isVisible = true;
          inst.checkCollisions = true;
          inst.receiveShadows = true;
          inst.metadata = { asset_id: gid };
          if (shadowList && !NO_SHADOW.test(part.name)) shadowList.push(inst);
        }
      }
    }
  }
}

async function upgradeAircraft(scene: Scene, anchors: Map<string, TransformNode>, shadow: ShadowGenerator): Promise<void> {
  const anchor = anchors.get('AIRCRAFT-001');
  if (!anchor) return;
  const before = new Set(anchor.getChildMeshes(false));
  const meshes = await loadModelAsync(scene, {
    modelPath: 'glb:aircraft_a320.glb',
    parent: anchor,
    position: [0, 0, 45],
    assetId: 'AIRCRAFT-001',
    shadow,
    excludeShadow: NO_SHADOW,
    collisions: /Fuselage|Wing/,
    label: 'A320 AIRCRAFT-001',
  });
  if (meshes.length > 0) {
    // Dispose the procedural exterior so beacons/focus resolve to GLB meshes.
    // (Interior cabin + fleet ticks reference the shared host, not these.)
    before.forEach((m) => {
      if (!meshes.includes(m)) m.dispose();
    });
  }
}

/** Static check-in queue: 6 GPU-instanced humans, 1.65–1.85 m tall. */
async function upgradeQueue(scene: Scene, anchors: Map<string, TransformNode>, shadow: ShadowGenerator): Promise<void> {
  const anchor = anchors.get('PAX-QUEUE-01');
  if (!anchor) return;
  const template = await loadModelAsync(scene, {
    modelPath: 'glb:human.glb',
    parent: anchor,
    position: [0, -10, 0],
    assetId: 'PAX-QUEUE-01',
    shadow: null,
    label: 'passenger (template)',
  });
  if (template.length === 0) return;
  const parts = template.filter((m): m is Mesh => m instanceof Mesh);
  parts.forEach((m) => { m.isVisible = false; });
  const shadowList = shadow.getShadowMap()?.renderList;
  for (let i = 0; i < 6; i++) {
    const h = 0.94 + i * 0.024; // 1.65m … 1.85m of the 1.75m base model
    for (const part of parts) {
      const inst = part.createInstance(`pax_${i}_${part.name}`);
      inst.parent = anchor;
      inst.position.set((i % 2 === 0 ? -0.15 : 0.15), 0, -1.5 + i * 1.15);
      inst.rotation.y = (i % 2 === 0 ? -1 : 1) * 0.12;
      inst.scaling.set(h, h, h);
      inst.isVisible = true;
      inst.checkCollisions = true;
      inst.receiveShadows = true;
      inst.metadata = { asset_id: 'PAX-QUEUE-01' };
      if (shadowList) shadowList.push(inst);
    }
  }
}

/** Fire-and-forget from createScene; never rejects (fallbacks stay on error). */
export async function upgradeToRealModels(
  scene: Scene,
  anchors: Map<string, TransformNode>,
  shadow: ShadowGenerator,
): Promise<void> {
  try {
    // 7 template loads: 2 arches + 2 FIDS + chair + aircraft + human.
    modelLoadTracker.start(7);
    await upgradeSecurity(scene, anchors, shadow);
    await upgradeFids(scene, anchors, shadow);
    await upgradeSeating(scene, anchors, shadow);
    await upgradeAircraft(scene, anchors, shadow);
    await upgradeQueue(scene, anchors, shadow);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[models] upgrade pass failed, primitives remain:', err);
  }
}
