import { AbstractMesh, Color4, DefaultRenderingPipeline, Engine, Scene, SSAO2RenderingPipeline, TransformNode, Vector3 } from '@babylonjs/core';
import { createCameras } from '../camera/cameras';
import { updateFollowCamera } from '../camera/cameras';
import { buildImageProcessingAndIBL, buildLighting } from './lighting';
import { buildMaterials } from './materials';
import { buildTerminal } from './terminal';
import { buildAircraftExterior, buildAircraftInterior, buildFleet } from './aircraft';
import { buildGroundOps } from './vehicles';
import { buildCrowd } from './people';
import { buildBaggageSystem } from './baggage';
import { buildEnvironment } from './environment';
import { prepareRealModelAnchors, upgradeToRealModels } from './realModels';

// Units: meters. Y up. (Babylon left-handed). See docs/coordinate-system.md
export function createWorld(canvas: HTMLCanvasElement) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  // Photorealistic daylight atmosphere sky
  scene.clearColor = new Color4(0.55, 0.72, 0.88, 1.0);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.9, 0);

  const mats = buildMaterials(scene);
  const { shadow } = buildLighting(scene);
  // Step 1: ACES tone mapping + exposure/contrast + IBL environment.
  buildImageProcessingAndIBL(scene);

  // Post-process: MSAA + subtle sharpen, SSAO for depth (cheap half-ratio).
  // Created after cameras so the pipeline attaches to every camera.
  const setupPostProcess = () => {
    const pipeline = new DefaultRenderingPipeline('renderPipeline', true, scene, scene.cameras);
    pipeline.samples = 4;
    pipeline.imageProcessingEnabled = true;
    pipeline.bloomEnabled = false;
    pipeline.depthOfFieldEnabled = false;
    pipeline.grainEnabled = false;
    pipeline.sharpenEnabled = true;
    try {
      const ssao = new SSAO2RenderingPipeline('ssao', scene, 0.5);
      ssao.totalStrength = 0.8;
      ssao.radius = 3.0;
      scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('ssao', scene.cameras);
    } catch {
      // SSAO unsupported on this GPU — scene stays valid without it.
    }
  };

  const world = new TransformNode('world', scene);
  // Visual environment pass: sky, terrain, taxiway, horizon, contact shadows (no layout changes)
  buildEnvironment(scene, mats, world);
  const terminal = buildTerminal(scene, mats);
  terminal.groups.forEach((g) => {
    if (g.parent == null) g.parent = world;
  });

  // Aircraft exterior + interior share stand A12
  const aircraftHost = new TransformNode('APRON-A12', scene);
  aircraftHost.parent = world;
  const aircraftTick = buildAircraftExterior(scene, mats, aircraftHost);
  buildAircraftInterior(scene, mats, aircraftHost);
  const fleetTicks = buildFleet(scene, mats, aircraftHost);
  const vehicleTick = buildGroundOps(scene, mats, aircraftHost);
  const baggageTick = buildBaggageSystem(scene, mats, world);

  const anchors = new Map<string, TransformNode>(terminal.groups);
  // Every builder anchor (aircraft, vehicles, equipment) keyed by asset_id
  aircraftHost.getChildTransformNodes(false).forEach((t) => {
    if (!anchors.has(t.name)) anchors.set(t.name, t as TransformNode);
  });
  // Step 2: anchors for GLB-only assets must exist before buildMeshes runs.
  prepareRealModelAnchors(scene, anchors);

  // Active Human/Passenger Crowd across all airport zones (built BEFORE shadow
  // registration so people + carried luggage also cast geometry-correct shadows)
  const crowd = buildCrowd(scene, 130);

  // High-quality object-specific shadows: every opaque scene mesh casts its own
  // geometry silhouette (people -> human shadows, suitcases -> suitcase shadows,
  // aircraft -> full wing/fuselage shadow). Grounds receive; sky/glow/decals excluded.
  const shadowList = shadow.getShadowMap()?.renderList;
  if (shadowList) {
    terminal.shadowCasters.forEach((m) => shadowList.push(m));
    const EXCLUDE = /skyDome|sunGlow|blobShadow|CONTACT|csNose|csMain|csEng|csBelly|csGPU|csTug|csBus|csCater|csFuel|csBag|csDolly|aoSouth|aoNorth|aoEast|aoWest|foundationAO|winRim|win_|cockpitShield|busDest|standNum|leadIn|standLine|noseStop|hazardLine|linkDash|twDash|taxiPaint|tagMat|plate_|fids_|textPlate/i;
    scene.meshes.forEach((m: AbstractMesh) => {
      const mat: any = m.material;
      const isTransparent =
        (mat && (mat.alpha !== undefined && mat.alpha < 1)) ||
        /glass|cockpitGlass|busWin|busFront|tugCabGlass|caterWindshield|fuelWindshield|carCabin|winMat|ghost/i.test(m.name);
      if (EXCLUDE.test(m.name)) {
        return;
      }
      if (!isTransparent && m.isVisible !== false && !m.name.startsWith('fencePostProto')) {
        shadowList.push(m);
      }
      if (/apronTarmac|apronServiceRoad|taxiway|taxiwayLink|farTerrain|grass|dropOffRoad|accessHighway|parkingP1Ground|cabinFloor/i.test(m.name)) {
        m.receiveShadows = true;
      }
    });
    // Apron + taxiway grounds always receive so aircraft/vehicle/people shadows land.
    scene.meshes.forEach((m: AbstractMesh) => {
      if (/apron|taxiway|grass|farTerrain|Road|Parking|Ground|Floor/i.test(m.name) && m.getTotalVertices() > 4) {
        m.receiveShadows = true;
      }
    });
  }

  // Aircraft + crowd anchors already registered above; cameras last.
  const cams = createCameras(scene, canvas);
  setupPostProcess();

  // Step 2: async GLB upgrade inside the same anchors (fallbacks stay on error).
  // App awaits `modelsReady` before buildMeshes so beacons bind to GLB meshes.
  const modelsReady = upgradeToRealModels(scene, anchors, shadow);

  let t = 0;
  let last = performance.now();
  // First-person head bob: subtle vertical sway while WASD keys are held.
  let bobPhase = 0;
  const bobBaseY = 1.7;
  const bobKeys = new Set<number>();
  addEventListener('keydown', (e) => bobKeys.add(e.keyCode));
  addEventListener('keyup', (e) => bobKeys.delete(e.keyCode));
  const isWalking = () => [87, 83, 65, 68, 38, 40, 37, 39].some((k) => bobKeys.has(k));
  scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;

    aircraftTick.update(dt, t);
    fleetTicks.forEach((f) => f.update(dt, t));
    vehicleTick.update(dt, t);
    baggageTick.update(dt, t);
    crowd.update(dt, t);
    // Step 3: third-person chase rig (no-op unless following a live target).
    updateFollowCamera(scene, cams, dt);

    // Head bob on the first-person camera only.
    if (scene.activeCamera === cams.fp) {
      if (isWalking()) {
        bobPhase += dt * 9;
        cams.fp.position.y += (bobBaseY + Math.sin(bobPhase) * 0.035 - cams.fp.position.y) * Math.min(1, dt * 10);
      } else {
        bobPhase = 0;
        cams.fp.position.y += (bobBaseY - cams.fp.position.y) * Math.min(1, dt * 6);
      }
    }

    // Sliding Entrance & Gate Doors: smoothly open when active camera is near
    const fp = scene.activeCamera?.position;
    if (fp) {
      for (const d of terminal.doors) {
        const dist = Math.hypot(fp.x - d.cx, fp.z - d.cz);
        const near = dist < 4.5;
        const target = near ? 1.35 : 0;
        const cur = Number(d.L.metadata?.slide ?? 0);
        const next = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt * 2.0);
        d.L.metadata = { ...(d.L.metadata ?? {}), slide: next };
        const hw = d.L.getBoundingInfo().boundingBox.extendSize.x || 0.8;
        d.L.position.x = d.cx - hw - next;
        d.R.position.x = d.cx + hw + next;
      }
    }
  });

  engine.runRenderLoop(() => scene.render());
  addEventListener('resize', () => engine.resize());
  return { engine, scene, cams, canvas, anchors, crowd, modelsReady };
}
