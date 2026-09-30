import { Color3, DynamicTexture, PBRMaterial, Scene, Texture } from '@babylonjs/core';

/** Shared PBR materials + canvas-generated textures (no external downloads needed). */
export interface Mats {
  floor: PBRMaterial;
  concourseFloor: PBRMaterial;
  wall: PBRMaterial;
  ceiling: PBRMaterial;
  glass: PBRMaterial;
  white: PBRMaterial;
  darkMetal: PBRMaterial;
  steel: PBRMaterial;
  chrome: PBRMaterial;
  belt: PBRMaterial;
  fuselage: PBRMaterial;
  cockpitGlass: PBRMaterial;
  wing: PBRMaterial;
  tire: PBRMaterial;
  seatFabric: PBRMaterial;
  bin: PBRMaterial;
  counter: PBRMaterial;
  woodTrim: PBRMaterial;
  screen: PBRMaterial;
  asphalt: PBRMaterial;
  taxiwayAsphalt: PBRMaterial;
  road: PBRMaterial;
  parkingAsphalt: PBRMaterial;
  grass: PBRMaterial;
  roof: PBRMaterial;
  hiVisYellow: PBRMaterial;
  hiVisOrange: PBRMaterial;
  customsGreen: PBRMaterial;
  customsRed: PBRMaterial;
}

function applyTextureQuality(dt: DynamicTexture | Texture): void {
  dt.anisotropicFilteringLevel = 8;
  dt.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE);
}

function canvasTex(name: string, scene: Scene, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, w = 1024, h = 1024) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const dt = new DynamicTexture(name, c, scene, true);
  dt.hasAlpha = false;
  dt.wrapU = dt.wrapV = Texture.WRAP_ADDRESSMODE;
  applyTextureQuality(dt);
  return dt;
}

export function textPlate(
  scene: Scene,
  text: string,
  opts: { w?: number; h?: number; bg?: string; fg?: string; font?: number; border?: string; sub?: string } = {},
) {
  const { w = 512, h = 128, bg = '#0b2a4a', fg = '#ffffff', font = 56, border = '#38bdf8', sub = '' } = opts;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, '#051324');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.strokeStyle = border;
  g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);

  g.fillStyle = fg;
  g.font = `bold ${font}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  if (sub) {
    g.fillText(text, w / 2, h / 2 - 14);
    g.font = `bold ${Math.round(font * 0.45)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    g.fillStyle = '#94a3b8';
    g.fillText(sub, w / 2, h / 2 + font * 0.45);
  } else {
    g.fillText(text, w / 2, h / 2);
  }

  const dt = new DynamicTexture(`plate_${text}`, c, scene, true);
  applyTextureQuality(dt);
  const m = new PBRMaterial(`plate_${text}_mat`, scene);
  m.albedoTexture = dt;
  m.emissiveTexture = dt;
  m.emissiveColor = new Color3(1, 1, 1);
  m.roughness = 0.6;
  m.metallic = 0.0;
  m.unlit = true;
  m.backFaceCulling = false;
  return m;
}

/** Flight-information board texture with live-looking rows. */
export function fidsTexture(scene: Scene, title: string, rows: string[][]) {
  const w = 1024, h = 640;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  g.fillStyle = '#060f1e';
  g.fillRect(0, 0, w, h);

  const hGrad = g.createLinearGradient(0, 0, w, 0);
  hGrad.addColorStop(0, '#1e3a8a');
  hGrad.addColorStop(1, '#0f172a');
  g.fillStyle = hGrad;
  g.fillRect(0, 0, w, 80);

  g.fillStyle = '#fbbf24';
  g.font = 'bold 42px -apple-system, BlinkMacSystemFont, sans-serif';
  g.textAlign = 'left';
  g.fillText(`✈  ${title}`, 30, 56);

  g.fillStyle = '#93c5fd';
  g.font = 'bold 30px monospace';
  g.textAlign = 'right';
  g.fillText('LOCAL TIME  18:25', w - 30, 56);

  g.fillStyle = '#64748b';
  g.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
  g.textAlign = 'left';
  g.fillText('FLIGHT', 30, 120);
  g.fillText('DESTINATION', 220, 120);
  g.fillText('TIME', 560, 120);
  g.fillText('GATE', 710, 120);
  g.fillText('STATUS', 840, 120);

  g.strokeStyle = '#1e293b';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(20, 135);
  g.lineTo(w - 20, 135);
  g.stroke();

  rows.forEach((r, i) => {
    const y = 180 + i * 72;
    g.fillStyle = i % 2 === 0 ? '#0b192e' : '#081220';
    g.fillRect(15, y - 42, w - 30, 64);

    g.font = 'bold 30px monospace';
    g.fillStyle = '#38bdf8';
    g.fillText(r[0] || 'MS100', 30, y);

    g.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
    g.fillStyle = '#f8fafc';
    g.fillText(r[1] || 'CITY', 220, y);

    g.font = '26px monospace';
    g.fillStyle = '#cbd5e1';
    g.fillText(r[2] || '18:40', 560, y);

    g.font = 'bold 28px monospace';
    g.fillStyle = '#fbbf24';
    g.fillText(r[3] || 'A12', 710, y);

    const statusText = r[4] || (r[2]?.includes('BOARD') ? 'BOARDING' : 'ON TIME');
    const isBoarding = statusText.includes('BOARD');
    const isDelayed = statusText.includes('DELAY');

    const badgeColor = isBoarding ? '#16a34a' : isDelayed ? '#ea580c' : '#0284c7';
    g.fillStyle = badgeColor;
    g.beginPath();
    if ((g as any).roundRect) {
      (g as any).roundRect(830, y - 30, 160, 42, 6);
    } else {
      g.rect(830, y - 30, 160, 42);
    }
    g.fill();

    g.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.fillText(statusText, 910, y - 2);
    g.textAlign = 'left';
  });

  const dt = new DynamicTexture(`fids_${title}`, c, scene, true);
  applyTextureQuality(dt);
  const m = new PBRMaterial(`fids_${title}_mat`, scene);
  m.albedoTexture = dt;
  m.emissiveTexture = dt;
  m.emissiveColor = new Color3(1, 1, 1);
  m.roughness = 0.6;
  m.metallic = 0.0;
  m.unlit = true;
  return m;
}

export function buildMaterials(scene: Scene): Mats {
  const pbr = (n: string, albedo: Color3, rough = 0.5, metal = 0.0) => {
    const m = new PBRMaterial(n, scene);
    m.albedoColor = albedo;
    m.roughness = rough;
    m.metallic = metal;
    return m;
  };

  // 1. Polished architectural terrazzo floor
  const floor = pbr('floor', new Color3(0.9, 0.91, 0.93), 0.18, 0.08);
  floor.albedoTexture = canvasTex('floorTerrazzo', scene, (g, w, h) => {
    g.fillStyle = '#e2e6eb';
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 2 + 0.5;
      const grey = Math.floor(180 + Math.random() * 60);
      g.fillStyle = `rgba(${grey}, ${grey + 5}, ${grey + 10}, 0.35)`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }

    g.strokeStyle = '#c4c9d1';
    g.lineWidth = 3;
    const tiles = 8;
    const step = w / tiles;
    for (let i = 0; i <= tiles; i++) {
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step, h);
      g.stroke();

      g.beginPath();
      g.moveTo(0, i * step);
      g.lineTo(w, i * step);
      g.stroke();
    }
  }, 1024, 1024);

  // 2. Concourse carpet for boarding gate areas
  const concourseFloor = pbr('concourseFloor', new Color3(0.3, 0.36, 0.45), 0.85, 0.0);
  concourseFloor.albedoTexture = canvasTex('gateCarpet', scene, (g, w, h) => {
    g.fillStyle = '#1e293b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#334155';
    g.lineWidth = 4;
    for (let x = 0; x < w; x += 64) {
      for (let y = 0; y < h; y += 64) {
        g.strokeRect(x + 8, y + 8, 48, 48);
        g.fillStyle = (x + y) % 128 === 0 ? '#2563eb' : '#0f172a';
        g.fillRect(x + 20, y + 20, 24, 24);
      }
    }
  }, 512, 512);

  // 3. Wall architectural panels
  const wall = pbr('wall', new Color3(0.92, 0.93, 0.95), 0.65, 0.05);
  wall.albedoTexture = canvasTex('wallPanels', scene, (g, w, h) => {
    g.fillStyle = '#e8ecf1';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 4;
    for (let y = 0; y < h; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    for (let y = 0; y < h; y += 128) {
      const offset = (y / 128) % 2 === 0 ? 0 : 256;
      for (let x = offset; x < w; x += 512) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 128);
        g.stroke();
      }
    }
  }, 1024, 1024);

  // 4. Acoustic baffle ceiling
  const ceiling = pbr('ceiling', new Color3(0.95, 0.96, 0.97), 0.75, 0.1);
  ceiling.albedoTexture = canvasTex('ceilingTex', scene, (g, w, h) => {
    g.fillStyle = '#f1f5f9';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, 512, 512);

  const white = pbr('white', new Color3(0.94, 0.95, 0.97), 0.35, 0.15);
  const darkMetal = pbr('darkMetal', new Color3(0.14, 0.15, 0.18), 0.38, 0.85);
  const steel = pbr('steel', new Color3(0.62, 0.65, 0.7), 0.25, 0.92);
  const chrome = pbr('chrome', new Color3(0.92, 0.94, 0.96), 0.05, 0.98);
  const belt = pbr('belt', new Color3(0.12, 0.13, 0.15), 0.88, 0.05);

  const fuselage = pbr('fuselage', new Color3(0.96, 0.97, 0.99), 0.18, 0.25);
  const wing = pbr('wing', new Color3(0.82, 0.84, 0.88), 0.32, 0.45);

  const tire = pbr('tire', new Color3(0.1, 0.1, 0.11), 0.92, 0.02);
  tire.albedoTexture = canvasTex('tireTread', scene, (g, w, h) => {
    g.fillStyle = '#18181b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#09090b';
    for (let x = 0; x < w; x += 32) {
      g.fillRect(x, 0, 14, h);
    }
  }, 256, 256);

  const seatFabric = pbr('seatFabric', new Color3(0.12, 0.28, 0.58), 0.82, 0.0);
  const bin = pbr('bin', new Color3(0.88, 0.89, 0.92), 0.45, 0.1);
  const counter = pbr('counter', new Color3(0.15, 0.25, 0.42), 0.35, 0.3);
  const woodTrim = pbr('woodTrim', new Color3(0.42, 0.26, 0.16), 0.4, 0.05);

  const roof = pbr('roof', new Color3(0.42, 0.45, 0.5), 0.55, 0.5);
  roof.albedoTexture = canvasTex('roofSeams', scene, (g, w, h) => {
    g.fillStyle = '#475569';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#334155';
    for (let x = 0; x < w; x += 64) {
      g.fillRect(x, 0, 8, h);
    }
  }, 512, 512);

  // Natural airfield grass — muted, desaturated, large-scale variation (not cartoon green)
  const grass = pbr('grass', new Color3(0.32, 0.4, 0.24), 0.96, 0.0);
  grass.albedoTexture = canvasTex('airfieldGrassTex', scene, (g, w, h) => {
    g.fillStyle = '#5a6b42';
    g.fillRect(0, 0, w, h);
    // Large soft patches (dry / lush variation)
    for (let i = 0; i < 90; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      const r = 20 + Math.random() * 70;
      const tones = ['rgba(122,128,84,0.20)', 'rgba(74,88,52,0.22)', 'rgba(139,134,102,0.14)', 'rgba(62,74,44,0.20)'];
      g.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      g.beginPath();
      g.arc(rx, ry, r, 0, Math.PI * 2);
      g.fill();
    }
    // Fine grain
    for (let i = 0; i < 5200; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      g.fillStyle = Math.random() > 0.5 ? 'rgba(52,64,38,0.28)' : 'rgba(128,134,92,0.25)';
      g.fillRect(rx, ry, Math.random() * 3 + 1, Math.random() * 3 + 1);
    }
  }, 512, 512);

  const glass = pbr('glass', new Color3(0.65, 0.82, 0.95), 0.04, 0.2);
  glass.alpha = 0.32;
  glass.directIntensity = 1.4;

  const cockpitGlass = pbr('cockpitGlass', new Color3(0.04, 0.08, 0.14), 0.06, 0.95);

  const screen = pbr('screen', new Color3(0.03, 0.08, 0.15), 0.4, 0.0);
  screen.emissiveColor = new Color3(0.15, 0.35, 0.55);

  // Apron Tarmac: Concrete Slabs, Expansion Joints, Rubber Scrub & Oil Stains
  const asphalt = pbr('asphalt', new Color3(0.38, 0.4, 0.42), 0.85, 0.0);
  asphalt.albedoTexture = canvasTex('apronRealTex', scene, (g, w, h) => {
    g.fillStyle = '#454a50';
    g.fillRect(0, 0, w, h);

    // Concrete slab pitch joints
    g.strokeStyle = '#1e2124';
    g.lineWidth = 5;
    const slabSize = w / 8;
    for (let x = 0; x <= w; x += slabSize) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    for (let y = 0; y <= h; y += slabSize) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }

    // Slab subtle tone variation
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const delta = Math.sin(x * 12.5 + y * 7.3) * 14;
        g.fillStyle = delta > 0 ? `rgba(255, 255, 255, ${(delta / 255) * 0.12})` : `rgba(0, 0, 0, ${(-delta / 255) * 0.22})`;
        g.fillRect(x * slabSize + 3, y * slabSize + 3, slabSize - 6, slabSize - 6);
      }
    }

    // Main Gear Rubber Scrub & Touchdown Marks
    for (let i = 0; i < 80; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h;
      g.fillStyle = 'rgba(15, 17, 20, 0.09)';
      g.beginPath();
      g.ellipse(rx, ry, Math.random() * 80 + 20, Math.random() * 14 + 4, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }

    // Oil & Hydraulic fluid stains under engine zones
    g.fillStyle = 'rgba(10, 12, 14, 0.18)';
    g.beginPath();
    g.ellipse(w * 0.4, h * 0.55, 60, 25, 0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(w * 0.6, h * 0.55, 60, 25, -0.2, 0, Math.PI * 2);
    g.fill();
  }, 1024, 1024);

  // Taxiway Dark Asphalt — weathered, worn centerline, tire polish band
  const taxiwayAsphalt = pbr('taxiwayAsphalt', new Color3(0.26, 0.27, 0.29), 0.92, 0.0);
  taxiwayAsphalt.albedoTexture = canvasTex('taxiwayTex', scene, (g, w, h) => {
    g.fillStyle = '#33363b';
    g.fillRect(0, 0, w, h);
    // aggregate noise
    for (let i = 0; i < 6000; i++) {
      const v = 40 + Math.random() * 30;
      g.fillStyle = `rgba(${v},${v},${v + 4},0.25)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // polished wheel tracks either side of centerline
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.38, 'rgba(12,13,15,0.28)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(0.62, 'rgba(12,13,15,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Worn Yellow Taxi Centerline (dashed wear, not solid cartoon)
    g.fillStyle = '#b89a1e';
    for (let y = 0; y < h; y += 64) {
      g.globalAlpha = 0.75 + Math.random() * 0.25;
      g.fillRect(w / 2 - 6, y + 8, 12, 40);
    }
    g.globalAlpha = 1;
    // Double Edge Lines (muted)
    g.fillStyle = 'rgba(190,170,60,0.7)';
    g.fillRect(20, 0, 5, h);
    g.fillRect(31, 0, 5, h);
    g.fillRect(w - 36, 0, 5, h);
    g.fillRect(w - 25, 0, 5, h);
  }, 1024, 1024);

  // Curbside Multi-lane Roadway
  const road = pbr('road', new Color3(0.2, 0.21, 0.23), 0.9, 0.0);
  road.albedoTexture = canvasTex('roadRealTex', scene, (g, w, h) => {
    g.fillStyle = '#27292d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f8fafc';
    for (let i = 0; i < 16; i++) {
      g.fillRect(15 + i * 64, h / 2 - 4, 36, 8);
    }
    g.fillStyle = '#eab308';
    g.fillRect(0, 24, w, 8);
    g.fillRect(0, h - 32, w, 8);
  }, 1024, 1024);

  // Parking Lot Asphalt
  const parkingAsphalt = pbr('parkingAsphalt', new Color3(0.24, 0.25, 0.27), 0.9, 0.0);
  parkingAsphalt.albedoTexture = canvasTex('parkingTex', scene, (g, w, h) => {
    g.fillStyle = '#2d3137';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    const bays = 8;
    const bW = w / bays;
    for (let i = 0; i <= bays; i++) {
      g.beginPath();
      g.moveTo(i * bW, 20);
      g.lineTo(i * bW, h / 2 - 40);
      g.stroke();

      g.beginPath();
      g.moveTo(i * bW, h / 2 + 40);
      g.lineTo(i * bW, h - 20);
      g.stroke();
    }
    g.fillStyle = '#ffffff';
    g.font = 'bold 36px sans-serif';
    g.fillText('➔', w / 4, h / 2 + 12);
    g.fillText('➔', (3 * w) / 4, h / 2 + 12);
  }, 1024, 1024);

  const hiVisYellow = pbr('hiVisYellow', new Color3(0.9, 0.85, 0.05), 0.5, 0.0);
  hiVisYellow.emissiveColor = new Color3(0.35, 0.32, 0.02);

  const hiVisOrange = pbr('hiVisOrange', new Color3(0.95, 0.45, 0.05), 0.5, 0.0);
  hiVisOrange.emissiveColor = new Color3(0.4, 0.18, 0.02);

  const customsGreen = pbr('customsGreen', new Color3(0.08, 0.55, 0.22), 0.5, 0.0);
  customsGreen.emissiveColor = new Color3(0.04, 0.25, 0.1);

  const customsRed = pbr('customsRed', new Color3(0.85, 0.12, 0.12), 0.5, 0.0);
  customsRed.emissiveColor = new Color3(0.35, 0.05, 0.05);

  return {
    floor, concourseFloor, wall, ceiling, glass, white, darkMetal, steel, chrome, belt,
    fuselage, cockpitGlass, wing, tire, seatFabric, bin, counter, woodTrim, screen,
    asphalt, taxiwayAsphalt, road, parkingAsphalt, grass, roof, hiVisYellow, hiVisOrange, customsGreen, customsRed,
  };
}
