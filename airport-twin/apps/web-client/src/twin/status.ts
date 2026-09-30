import { Color3, Mesh, MeshBuilder, PBRMaterial } from '@babylonjs/core';
import type { Status } from '../assets/registry';

// Color is only one channel: the UI always shows label + icon + timestamp too.
export const STATUS: Record<Status, { color: string; label: string; icon: string }> = {
  operational: { color: '#22c55e', label: 'Operational', icon: '●' },
  warning: { color: '#eab308', label: 'Warning', icon: '▲' },
  maintenance: { color: '#f97316', label: 'Maintenance', icon: '⚙' },
  critical: { color: '#ef4444', label: 'Critical', icon: '✖' },
  offline: { color: '#6b7280', label: 'Offline', icon: '⏻' },
  unknown: { color: '#9ca3af', label: 'No data', icon: '?' },
};

/**
 * Status visual: keep the realistic model untouched; add a floating status
 * beacon (emissive sphere on a thin pole above the asset). Returns the beacon
 * dot so it can be re-colored on updates.
 */
export function attachBeacon(host: Mesh, status: Status): Mesh {
  const scene = host.getScene();
  const bb = host.getBoundingInfo().boundingBox;
  const top = bb.maximumWorld.y + 0.7;
  const pole = MeshBuilder.CreateCylinder(`pole_${host.name}`, { height: 0.5, diameter: 0.04 }, scene);
  pole.position.set(host.position.x, top - 0.1, host.position.z); pole.isPickable = false;
  const pm = new PBRMaterial(`pm_${host.name}`, scene);
  pm.albedoColor = new Color3(0.2, 0.2, 0.25); pole.material = pm;
  const dot = MeshBuilder.CreateSphere(`beacon_${host.name}`, { diameter: 0.2 }, scene);
  dot.position.set(host.position.x, top + 0.25, host.position.z); dot.isPickable = false;
  colorBeacon(dot, status);
  return dot;
}

export function colorBeacon(dot: Mesh, status: Status) {
  let m = dot.material as PBRMaterial | null;
  if (!m || !(m instanceof PBRMaterial)) { m = new PBRMaterial(`bm_${dot.name}`, dot.getScene()); dot.material = m; }
  const c = Color3.FromHexString(STATUS[status].color);
  m.albedoColor = c; m.emissiveColor = c.scale(status === 'operational' ? 0.7 : 1.4);
}

/** Legacy: tint a mesh (used for simple equipment markers). */
export function applyStatus(mesh: Mesh, status: Status) {
  const mat = (mesh.material as PBRMaterial) ?? (mesh.material = new PBRMaterial(mesh.name, mesh.getScene()));
  const c = Color3.FromHexString(STATUS[status].color);
  mat.albedoColor = c;
  mat.emissiveColor = c.scale(status === 'operational' ? 0.15 : 0.5);
}
