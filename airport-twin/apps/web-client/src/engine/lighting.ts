import { Color3, CubeTexture, DirectionalLight, HemisphericLight, ImageProcessingConfiguration, PointLight, Scene, ShadowGenerator, SpotLight, Vector3 } from '@babylonjs/core';

/**
 * Step 1 — Rendering realism: IBL + ACES tone mapping.
 * Tries to load a prefiltered .env for true image-based lighting; on failure
 * (offline) the scene keeps working with sun + hemi lights only.
 */
export function buildImageProcessingAndIBL(scene: Scene): void {
  const cfg = scene.imageProcessingConfiguration;
  cfg.toneMappingEnabled = true;
  cfg.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  cfg.exposure = 1.1;
  cfg.contrast = 1.15;

  // Softer, less crushed PBR response under the existing sun intensity.
  scene.environmentIntensity = 0.65;

  if (!scene.environmentTexture) {
    try {
      scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
        'https://assets.babylonjs.com/environments/environmentSpecular.env',
        scene,
      );
    } catch {
      // Offline or blocked CDN — lights-only fallback, visuals stay valid.
    }
  }
}

/**
 * Realistic daylight airport lighting (final realism pass):
 * - High-resolution stabilized sun shadows (PCF blur, tuned frustum)
 * - Natural sun color / sky fill / warm ground bounce
 * - Apron high-mast floodlights on Stand A12
 * - Interior architectural illumination (unchanged behavior)
 */
export function buildLighting(scene: Scene): { shadow: ShadowGenerator } {
  // 1. Sky & Ground ambient illumination (soft environmental light)
  const hemi = new HemisphericLight('skyLight', new Vector3(0.25, 1, 0.2), scene);
  hemi.intensity = 0.95;
  hemi.diffuse = new Color3(0.78, 0.86, 0.96); // natural sky fill, not oversaturated
  hemi.groundColor = new Color3(0.45, 0.43, 0.38); // warm concrete/grass bounce
  hemi.specular = new Color3(0.08, 0.08, 0.09);

  // 2. Main Sun Directional Light — consistent daylight direction for whole scene
  const sun = new DirectionalLight('sun', new Vector3(-0.42, -1.0, -0.34).normalize(), scene);
  sun.position = new Vector3(60, 95, -25);
  sun.intensity = 2.1;
  sun.diffuse = new Color3(1.0, 0.96, 0.89); // warm-neutral noon sunlight
  sun.specular = new Color3(0.55, 0.55, 0.5);

  // Tighten shadow frustum to airport core => sharper texel density, less shimmer
  sun.autoCalcShadowZBounds = true;
  sun.shadowOrthoScale = 0.55;
  sun.shadowMinZ = 10;
  sun.shadowMaxZ = 260;

  // 3. High-Quality Stabilized Shadows
  const shadow = new ShadowGenerator(4096, sun);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 16;
  shadow.blurScale = 1.5;
  shadow.bias = 0.0004;
  shadow.normalBias = 0.02;
  shadow.darkness = 0.42; // keep shadows present but not crushing (AO handled by contact decals)
  shadow.frustumEdgeFalloff = 1.0;

  // 4. Apron High-Mast Floodlight array (Stand A12 illumination)
  const apronFlood = new SpotLight('apronFloodA12', new Vector3(8, 14, 26), new Vector3(-0.3, -0.9, 0.8), Math.PI / 2.8, 8, scene);
  apronFlood.intensity = 35;
  apronFlood.diffuse = new Color3(0.95, 0.98, 1.0);
  apronFlood.range = 55;

  const apronFlood2 = new SpotLight('apronFloodA12_2', new Vector3(-18, 14, 26), new Vector3(0.4, -0.9, 0.8), Math.PI / 2.8, 8, scene);
  apronFlood2.intensity = 30;
  apronFlood2.diffuse = new Color3(0.95, 0.98, 1.0);
  apronFlood2.range = 55;

  // 5. Terminal Architectural Downlights (Double-height Departure Hall & Concourse)
  const interiorSpots: [number, number, number][] = [
    [-15, 4.8, -14], [-5, 4.8, -14], [5, 4.8, -14], [15, 4.8, -14],
    [-15, 4.8, -6], [-5, 4.8, -6], [5, 4.8, -6], [15, 4.8, -6],
    [-8, 4.8, 2], [2, 4.8, 2], [12, 4.8, 2],
    [-14, 4.8, 12], [-8, 4.8, 12], [-2, 4.8, 12], [8, 4.8, 12],
  ];
  interiorSpots.forEach(([x, y, z], i) => {
    const p = new PointLight(`terminal_downlight_${i}`, new Vector3(x, y, z), scene);
    p.intensity = 16;
    p.diffuse.set(1.0, 0.95, 0.88); // warm white interior 3500K
    p.range = 14;
  });

  // 6. Curbside Landside Drop-off Canopy Warm Accent Lights
  const canopySpots: [number, number][] = [[-20, -21.5], [-10, -21.5], [0, -21.5], [10, -21.5], [20, -21.5]];
  canopySpots.forEach(([x, z], i) => {
    const p = new PointLight(`canopy_light_${i}`, new Vector3(x, 4.0, z), scene);
    p.intensity = 12;
    p.diffuse.set(1.0, 0.94, 0.82);
    p.range = 10;
  });

  // 7. Aircraft Interior Illumination
  const cabinFwd = new PointLight('cabinFwd', new Vector3(8, 2.7, 45), scene);
  cabinFwd.intensity = 18;
  cabinFwd.diffuse.set(0.98, 0.96, 0.92);
  cabinFwd.range = 22;

  const cabinAft = new PointLight('cabinAft', new Vector3(-6, 2.7, 45), scene);
  cabinAft.intensity = 18;
  cabinAft.diffuse.set(0.98, 0.96, 0.92);
  cabinAft.range = 22;

  const cockpit = new PointLight('cockpitLight', new Vector3(17, 2.4, 45), scene);
  cockpit.intensity = 8;
  cockpit.diffuse.set(0.4, 0.8, 1.0); // modern cyan glass-cockpit glow
  cockpit.range = 5;

  return { shadow };
}
