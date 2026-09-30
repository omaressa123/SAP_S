import { Color3, MeshBuilder, Scene, PBRMaterial } from '@babylonjs/core';

// Cargo hold: a separate space 50 m below the world (enter/leave via "Places").
// 24 x 8 x 3.6 m, two rows of containers with a 4 m aisle.
export function buildCargoHold(scene: Scene) {
  const paint = (n: string, c: Color3) => { const m = new PBRMaterial(n, scene); m.albedoColor = c; return m; };
  const shell = paint('hold', new Color3(0.55, 0.58, 0.6)), cont = paint('container', new Color3(0.8, 0.5, 0.15));
  const b = (n: string, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = MeshBuilder.CreateBox(n, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z); m.material = shell; m.checkCollisions = true; m.isPickable = false;
  };
  const Y = -50, Z = 100;
  b('hFloor', 24, 0.2, 8, 0, Y - 0.1, Z); b('hCeil', 24, 0.2, 8, 0, Y + 3.6, Z);
  b('hN', 24, 3.6, 0.3, 0, Y + 1.8, Z - 4); b('hS', 24, 3.6, 0.3, 0, Y + 1.8, Z + 4);
  b('hW', 0.3, 3.6, 8, -12, Y + 1.8, Z); b('hE', 0.3, 3.6, 8, 12, Y + 1.8, Z);
  const c = MeshBuilder.CreateBox('cont', { width: 2.2, height: 1.4, depth: 1.6 }, scene);
  c.material = cont; c.isVisible = false;
  for (let x = -9; x <= 9; x += 3) for (const z of [Z - 2.8, Z + 2.8]) {
    const i = c.createInstance(`cont_${x}_${z}`); i.position.set(x, Y + 0.7, z); i.checkCollisions = true; i.isPickable = false;
  }
}
