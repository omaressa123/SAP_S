import { useEffect, useMemo, useRef, useState } from 'react';
import { Color3, HighlightLayer, Mesh, PointerEventTypes, Ray, Vector3 } from '@babylonjs/core';
import { Asset, buildMeshes, loadRegistry } from './assets/registry';
import { createWorld } from './engine/createScene';
import { colorBeacon, STATUS } from './twin/status';
import { AIRCRAFT_VIEWS, PLACES, followAt, locateOnMap, setView, teleportTo, teleportToPlace } from './navigation/navigation';
import { connect, fetchFlights, fetchMode, fetchStates, login as loginApi } from './services/api';
import type { Cameras, ViewMode } from './camera/cameras';
import DetailsPanel from './ui/DetailsPanel';

type World = ReturnType<typeof createWorld> & { meshes: Map<string, Mesh>; beacons: Map<string, Mesh>; focusOf(id: string): Vector3; hl: HighlightLayer };

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'fp', label: 'First Person' }, { id: 'tp', label: 'Third Person' },
  { id: 'free', label: 'Free Camera' }, { id: 'ov', label: 'Overview' },
];

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const w = useRef<World | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [view, setViewMode] = useState<ViewMode>('fp');
  const [q, setQ] = useState('');
  const [sim, setSim] = useState<boolean | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [debug, setDebug] = useState(false);
  const [crowd, setCrowd] = useState<{ total: number; zones: { name: string; count: number }[] } | null>(null);
  const [flights, setFlights] = useState<{ flight: string; destination: string; stand: string; gate: string; phase: string; pax: number; fuel_pct: number }[]>([]);
  const [tick, setTick] = useState(0);
  const status = useRef<Record<string, string>>({});
  const liveRef = useRef(false);

  const patch = (id: string, p: Partial<Asset>) => {
    setAssets((prev) => prev.map((a) => (a.asset_id === id ? { ...a, ...p } : a)));
    const W = w.current;
    if (p.status && W) {
      status.current[id] = p.status;
      const b = W.beacons.get(id);
      if (b) colorBeacon(b, p.status);
    }
  };
  const select = (id: string) => {
    setSel(id);
    const W = w.current; if (!W) return;
    W.hl.removeAllMeshes();
    // highlight whole asset group: every mesh tagged with this asset_id
    W.scene.meshes.forEach((m) => {
      if ((m.metadata as any)?.asset_id === id && (m as Mesh).isVisible !== false) {
        try { W.hl.addMesh(m as Mesh, Color3.White()); } catch { /* cap */ }
      }
    });
  };
  const focusId = (id: string) => {
    const W = w.current; if (!W) return;
    const target = W.focusOf(id);
    // standoff by asset size so the camera never ends up inside the mesh
    const rep = W.meshes.get(id);
    let dist = 7;
    if (rep) {
      rep.computeWorldMatrix(true);
      const bb = rep.getBoundingInfo().boundingBox;
      const size = bb.maximumWorld.subtract(bb.minimumWorld).length();
      dist = Math.min(42, Math.max(6, size * 1.1 + 3));
    }
    const cam = W.scene.activeCamera!;
    const dir = target.subtract(cam.position);
    dir.y = 0;
    if (dir.length() < 1e-3) dir.set(0, 0, -1);
    dir.normalize();
    const eye = target.subtract(dir.scale(dist));
    eye.y = Math.max(1.7, target.y + dist * 0.18);
    // Never frame from inside solid geometry: if a wall/mast/fuselage sits
    // between the target and the computed eye, pull the eye in front of it.
    {
      const toEye = eye.subtract(target);
      const len = toEye.length();
      if (len > 1e-3) {
        toEye.normalize();
        const hit = W.scene.pickWithRay(
          new Ray(target, toEye, len),
          (m) => m instanceof Mesh && m.checkCollisions && m.isVisible !== false && m !== rep,
        );
        if (hit?.hit && hit.distance < len) {
          const safe = Math.max(0.8, hit.distance - 0.6);
          eye.copyFrom(target.add(toEye.scale(safe)));
          eye.y = Math.max(eye.y, 1.2);
        }
      }
    }
    setView(W.scene, W.canvas, W.cams as Cameras, 'fp');
    (W.cams as Cameras).fp.position.copyFrom(eye);
    (W.cams as Cameras).fp.setTarget(target);
    setViewMode('fp');
  };

  useEffect(() => {
    let off = () => {}, dead = false;
    const statTimer = setInterval(() => {
      const W = w.current as any;
      if (W?.crowd) setCrowd(W.crowd.stats());
      setTick((t) => t + 1); // minimap player dot refresh
    }, 500);
    (async () => {
      const reg = await loadRegistry(); if (dead) return;
      const world = createWorld(canvas.current!);
      // Wait for GLB upgrades (bounded): beacons then bind to real models.
      // Primitives stay as fallback if the timeout or a load fails.
      try {
        await Promise.race([
          world.modelsReady,
          new Promise((r) => setTimeout(r, 10000)),
        ]);
      } catch { /* fallbacks remain */ }
      if (dead) return;
      const { map, beacons, focusOf } = buildMeshes(world.scene, reg, world.anchors);
      const W = { ...world, meshes: map, beacons, focusOf, hl: new HighlightLayer('hl', world.scene) } as World;
      w.current = W;
      (window as any).__twin = { beacons, focusOf, scene: world.scene };
      reg.forEach((a) => { status.current[a.asset_id] = a.status; });
      setAssets(reg);
      world.scene.onPointerObservable.add((p) => {
        if (p.type !== PointerEventTypes.POINTERPICK) return;
        const id = (p.pickInfo?.pickedMesh?.metadata as any)?.asset_id as string | undefined;
        if (id) select(id);
      });
      try {
        (await fetchStates()).forEach((s) =>
          patch(s.asset_id!, { status: s.status, location: s.location, last_update: s.last_update, metadata: (s as any).metadata }));
        setFlights(await fetchFlights());
        setSim((await fetchMode()).simulation);
      } catch (e) {
        // Step 5: backend requires JWT — show the login gate instead of failing silent.
        if (`${e}`.includes('unauthorized')) setNeedLogin(true);
        /* backend offline: scene still works */
      }
      off = connect((e) => {
        if (e.event === 'asset_status_changed' && e.status) patch(e.asset_id, { status: e.status, reason: e.reason, last_update: e.timestamp });
        else if (e.event === 'device_alert') patch(e.asset_id, { status: (e.status as Asset['status']) ?? 'warning', reason: `${(e as unknown as { kind?: string }).kind ?? 'alert'} — check device`, last_update: e.timestamp });
        else if (e.event === 'asset_telemetry' && e.telemetry) {
          setAssets((prev) => prev.map((a) => (a.asset_id === e.asset_id ? { ...a, metadata: { ...(a.metadata ?? {}), ...e.telemetry }, last_update: e.timestamp } : a)));
        } else if ((e.event as string) === 'fids_updated' && e.telemetry?.board) {
          setFlights(e.telemetry.board);
        }
      }, (up) => { liveRef.current = up; setLive(up); });
    })();
    return () => { dead = true; off(); clearInterval(statTimer); w.current?.engine.dispose(); w.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = assets.find((a) => a.asset_id === sel);
  const goView = (v: ViewMode) => {
    const W = w.current; if (!W) return;
    setView(W.scene, W.canvas, W.cams as Cameras, v);
    setViewMode(v);
  };
  const goAircraft = (i: number) => {
    const W = w.current; if (!W) return;
    const v = AIRCRAFT_VIEWS[i];
    setView(W.scene, W.canvas, W.cams as Cameras, 'free');
    (W.cams as Cameras).free.setPosition(new Vector3(...v.pos));
    (W.cams as Cameras).free.setTarget(new Vector3(...v.tgt));
    setViewMode('free');
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assets;
    return assets.filter((a) => `${a.asset_id} ${a.name} ${a.asset_type} ${a.location ?? ''}`.toLowerCase().includes(s));
  }, [assets, q]);

  const player = w.current && tick >= 0 ? w.current.scene.activeCamera?.position : null;

  return (
    <>
      <canvas ref={canvas} />
      <header className="topbar">
        <strong>✈ SMART AIRPORT DIGITAL TWIN</strong>
        <span className={live ? 'ok' : 'warn'}>{live ? '● ONLINE' : '● BACKEND OFFLINE (scene works)'}</span>
        {sim !== null && (
          <span className={sim ? 'warn' : 'ok'} title={sim ? 'Driven by the Simulation Service' : 'Driven by real sensor ingest'}>
            {sim ? '◈ SIMULATION' : '◈ LIVE INGEST'}
          </span>
        )}
        {crowd && <span className="mute">Passengers: {crowd.total} · {crowd.zones.map((z) => `${z.name} ${z.count}`).join(' · ')}</span>}
        <label className="mute" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} /> Debug</label>
      </header>
      <nav className="side" aria-label="Assets">
        <strong>Assets</strong>
        <input className="search" placeholder="Search aircraft, gate, CAM-021…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search assets" />
        {filtered.map((a) => (
          <button key={a.asset_id} className={a.asset_id === sel ? 'on' : ''} onClick={() => { select(a.asset_id); focusId(a.asset_id); }}>
            <span>{a.asset_id} · {a.name}</span><span style={{ color: STATUS[a.status].color }}>{STATUS[a.status].icon}</span>
          </button>
        ))}
        <div className="mute" style={{ marginTop: 8 }}>Places (passenger flow)</div>
        {PLACES.map((p) => <button key={p.name} onClick={() => { const W = w.current!; teleportToPlace(W.scene, W.canvas, W.cams as Cameras, p); setViewMode('fp'); }}><span>{p.name}</span></button>)}
      </nav>
      {cur && <DetailsPanel a={cur} onClose={() => setSel(null)} onFocus={() => focusId(cur.asset_id)}
        onLocate={() => { const W = w.current!; locateOnMap(W.scene, W.canvas, W.cams as Cameras, W.focusOf(cur.asset_id)); setViewMode('ov'); }} />}
      <div className="bottombar" role="toolbar" aria-label="Cameras">
        {VIEWS.map((v) => <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => goView(v.id)}>{v.label}</button>)}
        <span className="mute">Aircraft:</span>
        {AIRCRAFT_VIEWS.map((v, i) => <button key={v.name} onClick={() => goAircraft(i)}>{v.name}</button>)}
        {/* Live TP follow rig (Step 3): representative meshes carry world coords; anchors sit at origin. */}
        <button onClick={() => { const W = w.current!; followAt(W.scene, W.canvas, W.cams as Cameras, W.meshes.get('AIRCRAFT-001') ?? W.focusOf('AIRCRAFT-001')); setViewMode('tp'); }}>Follow aircraft</button>
        <button onClick={() => { const W = w.current!; const pax = W.crowd.meshes[0]; followAt(W.scene, W.canvas, W.cams as Cameras, pax ?? W.focusOf('CHECKIN-001')); setViewMode('tp'); }}>Follow passenger</button>
        <button onClick={() => { const W = w.current!; followAt(W.scene, W.canvas, W.cams as Cameras, W.meshes.get('RB-007') ?? W.focusOf('RB-007')); setViewMode('tp'); }}>Follow robot</button>
        {['AIRCRAFT-002', 'AIRCRAFT-003', 'AIRCRAFT-004'].map((id) => (
          <button key={id} onClick={() => { select(id); focusId(id); }}>{id.replace('AIRCRAFT-', '✈ ')}</button>
        ))}
      </div>
      {flights.length > 0 && (
        <div className="fids-live" role="status" aria-label="Live departures">
          <strong>🛫 LIVE DEPARTURES</strong>
          {flights.map((f) => (
            <span key={f.flight} className="mute">{f.flight} → {f.destination} · Stand {f.stand} · {f.phase} · {f.pax} pax · ⛽{f.fuel_pct}%</span>
          ))}
        </div>
      )}
      <Minimap assets={assets} player={player ? { x: player.x, z: player.z } : null} sel={sel} onPick={(id) => { select(id); focusId(id); }} />
      {debug && cur && <DebugBox a={cur} world={w.current} />}
      <div className="hint">WASD move · drag to look · Shift sprint · click object for details</div>
      {needLogin && (
        <div className="side" style={{ left: '50%', top: '30%', transform: 'translateX(-50%)', width: 280 }} role="dialog" aria-label="Login">
          <strong>🔐 Twin login required</strong>
          <div className="mute">Dev accounts: viewer/view123 · operator/op123 · admin/admin123</div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            loginApi(`${fd.get('u')}`, `${fd.get('p')}`)
              .then(() => location.reload())
              .catch(() => setLoginErr('Bad username or password'));
          }}>
            <input className="search" name="u" placeholder="username" autoComplete="username" style={{ marginBottom: 6 }} />
            <input className="search" name="p" type="password" placeholder="password" autoComplete="current-password" style={{ marginBottom: 6 }} />
            <button type="submit" style={{ width: '100%' }}>Log in</button>
          </form>
          {loginErr && <div className="mute" style={{ color: '#f87171' }}>{loginErr}</div>}
        </div>
      )}
    </>
  );
}

function Minimap({ assets, player, sel, onPick }: { assets: Asset[]; player: { x: number; z: number } | null; sel: string | null; onPick(id: string): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext('2d')!;
    const W = 220, H = 190;
    const sx = (x: number) => ((x + 38) / 76) * W;
    const sz = (z: number) => ((z + 68) / 136) * H;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0f1720';
    g.fillRect(0, 0, W, H);

    // Parking P1
    g.fillStyle = '#1c2430';
    g.fillRect(sx(-35), sz(-68), sx(35) - sx(-35), sz(-50) - sz(-68));
    // Access Highway & Road
    g.fillStyle = '#262a30';
    g.fillRect(0, sz(-50), W, sz(-22) - sz(-50));
    // Terminal Building
    g.fillStyle = '#1e3a5f';
    g.fillRect(sx(-32), sz(-20), sx(32) - sx(-32), sz(20) - sz(-20));
    // Apron Stand A12
    g.fillStyle = '#3a3f45';
    g.fillRect(sx(-36), sz(20), W - sx(-36), sz(65) - sz(20));

    g.font = '8px system-ui';
    g.fillStyle = '#94a3b8';
    g.fillText('PARKING P1', sx(-30), sz(-58));
    g.fillText('TERMINAL A', sx(-28), sz(-10));
    g.fillText('APRON A12', sx(-6), sz(36));

    for (const a of assets) {
      const x = sx(a.position.x), y = sz(a.position.z);
      g.fillStyle = (STATUS[a.status] ?? STATUS.unknown).color;
      g.beginPath();
      g.arc(x, y, a.asset_id === sel ? 5 : 3, 0, 7);
      g.fill();
    }
    if (player) {
      g.fillStyle = '#ffffff4d';
      g.beginPath();
      g.arc(sx(player.x), sz(player.z), 4, 0, 7);
      g.fill();
      g.strokeStyle = '#60a5fa';
      g.stroke();
    }
  });
  return (
    <div className="minimap">
      <strong>Map</strong>
      <canvas
        ref={ref}
        width={220}
        height={190}
        onClick={(e) => {
          const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
          const mx = ((e.clientX - r.left) / r.width) * 220;
          const my = ((e.clientY - r.top) / r.height) * 190;
          const sx = (x: number) => ((x + 38) / 76) * 220;
          const sz = (z: number) => ((z + 68) / 136) * 190;
          let best: string | null = null, bd = 12;
          for (const a of assets) {
            const d = Math.hypot(sx(a.position.x) - mx, sz(a.position.z) - my);
            if (d < bd) {
              bd = d;
              best = a.asset_id;
            }
          }
          if (best) onPick(best);
        }}
      />
    </div>
  );
}

function DebugBox({ a, world }: { a: Asset; world: any }) {
  const m = world?.meshes.get(a.asset_id);
  const p = m?.position;
  return (
    <div className="side" style={{ left: 'auto', right: 320, top: 64, width: 250 }}>
      <strong>Debug</strong>
      <div className="mute">asset_id: {a.asset_id}</div>
      <div className="mute">type: {a.asset_type}</div>
      <div className="mute">pos: {p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` : '—'}</div>
      <div className="mute">status: {a.status}</div>
      <div className="mute">model: {a.model_path}</div>
    </div>
  );
}
