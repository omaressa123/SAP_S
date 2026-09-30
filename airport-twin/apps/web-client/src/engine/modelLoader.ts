import { AbstractMesh, Mesh, Scene, SceneLoader, ShadowGenerator, TransformNode } from '@babylonjs/core';

/**
 * Step 2 — Real GLB loading pipeline.
 *
 * model_path conventions (Registry `model_path` field):
 *   "procedural:<key>"  -> no remote file; run the fallback builder only.
 *   "glb:<file.glb>"    -> vendored file served at /assets/models/<file.glb>.
 *   "/...." / "http.."  -> used as-is (remote or absolute).
 *   "<file.glb>"        -> treated as vendored /assets/models/<file.glb>.
 *
 * Every load has a primitive fallback so a missing/corrupt file can never
 * blank the scene, plus a DOM progress bar while large models stream in.
 */

export function resolveModelUrl(model_path: string): string | null {
  if (!model_path || model_path.startsWith('procedural:')) return null;
  if (model_path.startsWith('glb:')) return `/assets/models/${model_path.slice(4)}`;
  if (/^https?:\/\//.test(model_path) || model_path.startsWith('/')) return model_path;
  if (model_path.endsWith('.glb') || model_path.endsWith('.gltf')) return `/assets/models/${model_path}`;
  return null;
}

/** Tiny DOM progress overlay: "Loading 3D models… 2/5". Hidden when idle. */
class ModelLoadTracker {
  private total = 0;
  private done = 0;
  private el: HTMLElement | null = null;
  private bar: HTMLElement | null = null;
  private label: HTMLElement | null = null;

  private ensure(): void {
    if (this.el || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.id = 'glb-loading';
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:64px', 'transform:translateX(-50%)',
      'z-index:60', 'display:none', 'align-items:center', 'gap:10px',
      'background:rgba(8,15,30,.92)', 'border:1px solid #1e3a8a', 'border-radius:10px',
      'padding:8px 14px', 'color:#e2e8f0', 'font:12px system-ui', 'min-width:260px',
    ].join(';');
    const label = document.createElement('span');
    label.id = 'glb-loading-label';
    label.textContent = 'Loading 3D models…';
    const track = document.createElement('div');
    track.style.cssText = 'flex:1;height:6px;background:#1e293b;border-radius:4px;overflow:hidden';
    const bar = document.createElement('div');
    bar.id = 'glb-loading-bar';
    bar.style.cssText = 'height:100%;width:0%;background:#38bdf8;border-radius:4px;transition:width .2s';
    track.appendChild(bar);
    el.appendChild(label);
    el.appendChild(track);
    document.body.appendChild(el);
    this.el = el;
    this.bar = bar;
    this.label = label;
  }

  start(total: number): void {
    this.total = total;
    this.done = 0;
    if (total <= 0) return;
    this.ensure();
    if (this.el) this.el.style.display = 'flex';
    this.render();
  }

  finishOne(): void {
    this.done += 1;
    this.render();
    if (this.done >= this.total && this.el) {
      window.setTimeout(() => { if (this.el) this.el.style.display = 'none'; }, 600);
    }
  }

  private render(): void {
    const pct = this.total > 0 ? Math.round((this.done / this.total) * 100) : 100;
    if (this.bar) this.bar.style.width = `${pct}%`;
    if (this.label) this.label.textContent = `Loading 3D models… ${Math.min(this.done, this.total)}/${this.total}`;
  }
}

export const modelLoadTracker = new ModelLoadTracker();

export interface GlbLoadOpts {
  /** Registry model_path value (glb:… / url). Null/ procedural => fallback only. */
  modelPath: string;
  /** Anchor the loaded model parents under (stable asset_id node). */
  parent: TransformNode;
  /** Local offset inside the anchor. */
  position?: [number, number, number];
  rotationY?: number;
  /** asset_id to stamp into loaded mesh metadata (click-to-select keeps working). */
  assetId?: string;
  /** Push loaded meshes into this shadow map (minus exclusions). */
  shadow?: ShadowGenerator | null;
  excludeShadow?: RegExp;
  /** Enable collisions on meshes matching this pattern (default: none). */
  collisions?: RegExp;
  /** Primitive fallback when there is no URL or the load fails. */
  fallback?: () => void;
  label?: string;
}

function splitUrl(url: string): [string, string] {
  const i = url.lastIndexOf('/');
  return i < 0 ? ['', url] : [url.slice(0, i + 1), url.slice(i + 1)];
}

/**
 * Load one GLB into `parent`. Returns the loaded meshes (empty on fallback).
 * Never throws: failures run `fallback` and resolve [].
 */
export async function loadModelAsync(scene: Scene, opts: GlbLoadOpts): Promise<AbstractMesh[]> {
  const url = resolveModelUrl(opts.modelPath);
  if (!url) {
    opts.fallback?.();
    return [];
  }
  const label = opts.label ?? opts.modelPath;
  try {
    const [rootUrl, fileName] = splitUrl(url);
    const res = await SceneLoader.ImportMeshAsync(null, rootUrl, fileName, scene, (evt) => {
      if (evt.lengthComputable) {
        // eslint-disable-next-line no-console
        console.debug(`[models] ${label}: ${evt.loaded}/${evt.total}`);
      }
    });
    const holder = new TransformNode(`${opts.assetId ?? 'glb'}_model`, scene);
    holder.parent = opts.parent;
    if (opts.position) holder.position.set(opts.position[0], opts.position[1], opts.position[2]);
    if (opts.rotationY) holder.rotation.y = opts.rotationY;
    const root = res.meshes[0];
    if (root) root.parent = holder;
    const all = holder.getChildMeshes(false, (n): n is Mesh => n instanceof Mesh);
    const shadowList = opts.shadow?.getShadowMap()?.renderList;
    for (const m of all) {
      m.isPickable = false;
      if (opts.assetId) m.metadata = { ...((m.metadata as object) ?? {}), asset_id: opts.assetId };
      if (opts.collisions?.test(m.name)) m.checkCollisions = true;
      if (shadowList && !(opts.excludeShadow?.test(m.name))) shadowList.push(m);
      m.receiveShadows = true;
    }
    // eslint-disable-next-line no-console
    console.info(`[models] loaded ${label}: ${all.length} meshes`);
    return all;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[models] ${label} failed, using primitive fallback:`, err);
    opts.fallback?.();
    return [];
  } finally {
    modelLoadTracker.finishOne();
  }
}

/** Scale a Y-up model so its bounding height becomes `targetH` meters. */
export function normalizeHeight(meshes: AbstractMesh[], targetH: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of meshes) {
    if (!(m instanceof Mesh)) continue;
    m.computeWorldMatrix(true);
    const bb = m.getBoundingInfo().boundingBox;
    minY = Math.min(minY, bb.minimumWorld.y);
    maxY = Math.max(maxY, bb.maximumWorld.y);
  }
  const h = maxY - minY;
  if (!isFinite(h) || h <= 0) return;
  const s = targetH / h;
  for (const m of meshes) {
    if (m.parent && (m.parent as TransformNode).name?.endsWith('_model')) {
      (m.parent as TransformNode).scaling.scaleInPlace(s);
      break;
    }
  }
}
