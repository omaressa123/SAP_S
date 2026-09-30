import { Fragment, useState } from 'react';
import type { Asset } from '../assets/registry';
import { STATUS } from '../twin/status';
import { fetchEvents } from '../services/api';

type Ev = Awaited<ReturnType<typeof fetchEvents>>;

const FALLBACK: Record<string, [string, string][]> = {
  'AIRCRAFT-001': [['Gate', 'A12'], ['Flight', 'MS123'], ['Destination', 'Cairo (CAI)']],
  'JETBRIDGE-001': [['Gate', 'A12'], ['Docked', 'Yes']],
  'CONV-001': [['Speed', '1.8 m/s'], ['Bags processed', '243']],
  'CONV-002': [['Speed', '1.6 m/s'], ['Bags processed', '187']],
  'CAM-021': [['FPS', '25'], ['Last detection', 'Passenger']],
  'CAM-001': [['FPS', '25'], ['Location', 'Security Gate']],
};

const LABELS: Record<string, string> = {
  gate: 'Gate', flight: 'Flight', destination: 'Destination', passengers: 'Passengers',
  fuel_pct: 'Fuel', speed_m_s: 'Speed', bags_processed: 'Bags processed', fps: 'FPS',
  last_detection: 'Last detection', location: 'Location', docked: 'Docked',
  boarding: 'Boarding', type: 'Aircraft type',
};
const pretty = (k: string) => LABELS[k] ?? k.replace(/_/g, ' ');
const fmt = (k: string, v: unknown) => {
  if (k === 'speed_m_s') return `${v} m/s`;
  if (k === 'fuel_pct') return `${v}%`;
  return String(v);
};

export default function DetailsPanel({ a, onFocus, onLocate, onClose }:
  { a: Asset; onFocus: () => void; onLocate: () => void; onClose: () => void }) {
  const [ev, setEv] = useState<Ev | null>(null);
  const [only, setOnly] = useState(false);
  const s = STATUS[a.status];
  const load = (maint: boolean) => { setOnly(maint); fetchEvents(a.asset_id).then(setEv).catch(() => setEv([])); };
  const shown = ev?.filter((e) => !only || e.payload?.status === 'maintenance');
  const meta = a.metadata ?? {};
  const rows: [string, string][] = [
    ...Object.entries(meta).map(([k, v]): [string, string] => [pretty(k), fmt(k, v)]),
    ...(FALLBACK[a.asset_id] ?? []).filter(([k]) => !(k.toLowerCase().replace(/ /g, '_') in meta) && !Object.keys(meta).some((mk) => pretty(mk) === k)),
  ];
  return (
    <aside className="panel" aria-live="polite">
      <button className="btn" style={{ float: 'right', marginTop: 0 }} onClick={onClose} aria-label="Close">✕</button>
      <h3 style={{ color: s.color }}>{s.icon} {s.label}</h3>
      <strong>{a.name}</strong>
      <div className="mute">{a.location ?? '—'} · {a.asset_type}</div>
      <dl>
        <dt className="mute">Asset ID</dt><dd>{a.asset_id}</dd>
        <dt className="mute">Status</dt><dd>{s.label}</dd>
        {rows.map(([k, v]) => (
          <Fragment key={k}><dt className="mute">{k}</dt><dd>{v}</dd></Fragment>
        ))}
        <dt className="mute">Last update</dt><dd>{a.last_update ? new Date(a.last_update).toLocaleTimeString() : 'No data'}</dd>
        <dt className="mute">Reason</dt><dd>{a.reason ?? '—'}</dd>
      </dl>
      {a.asset_id === 'AIRCRAFT-001' && (
        <p className="mute">{a.status === 'operational' ? 'Doors open — walk the jet bridge or teleport to Cabin.' : 'Entry unavailable while not operational.'}</p>
      )}
      <button className="btn" onClick={onFocus}>Focus camera</button>
      <button className="btn" onClick={() => load(false)}>View History</button>
      <button className="btn" onClick={onLocate}>Locate on Map</button>
      <button className="btn" onClick={() => load(true)}>Show Maintenance</button>
      {shown && (shown.length === 0 ? <p className="mute">No events yet.</p> :
        <ul style={{ paddingLeft: 16, maxHeight: 160, overflow: 'auto' }}>
          {shown.map((e, i) => <li key={i}>{new Date(e.created_at).toLocaleTimeString()} · {e.payload?.status} · {e.payload?.reason}</li>)}
        </ul>)}
    </aside>
  );
}
