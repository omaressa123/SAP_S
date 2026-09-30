import type { Asset } from '../assets/registry';

// Step 5: JWT auth. Token lives in localStorage; sent on REST + WS.
export const getToken = () => localStorage.getItem('twin_token');
export const setToken = (t: string | null) =>
  t ? localStorage.setItem('twin_token', t) : localStorage.removeItem('twin_token');

export async function login(username: string, password: string): Promise<{ role: string }> {
  const r = await fetch('/api/twin/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  if (!r.ok) throw new Error('login failed');
  const d = await r.json();
  setToken(d.access_token);
  return { role: d.role };
}

const authHeaders = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const j = (u: string) => fetch(u, { headers: authHeaders() }).then((r) => {
  if (r.status === 401) { setToken(null); throw new Error('unauthorized:' + u); }
  if (!r.ok) throw new Error(u);
  return r.json();
});
export const fetchStates = (): Promise<Partial<Asset>[]> => j('/api/twin/assets');
export const fetchFlights = (): Promise<{ flight: string; destination: string; stand: string; gate: string; phase: string; pax: number; fuel_pct: number }[]> => j('/api/twin/flights');
export const fetchEvents = (id: string): Promise<{ event_type: string; payload: any; created_at: string }[]> =>
  j(`/api/twin/assets/${id}/events`);
export const fetchMode = (): Promise<{ simulation: boolean; source: string }> => j('/api/twin/mode');

export interface TwinEvent {
  event: string; asset_id: string; status?: Asset['status']; reason?: string;
  timestamp: string; position?: { x: number; y: number; z: number }; telemetry?: Record<string, any>;
  /** "ingest" (real sensors) or "simulation" (Simulation Service). Absent on old servers. */
  source?: string;
}

export function connect(onEvent: (e: TwinEvent) => void, onState: (up: boolean) => void) {
  let ws: WebSocket | null = null, stop = false;
  const open = () => {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const token = getToken();
    ws = new WebSocket(`${scheme}://${location.host}/ws/twin${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    ws.onopen = () => onState(true);
    ws.onmessage = (m) => onEvent(JSON.parse(m.data));
    ws.onclose = (e) => {
      // 4401 = bad/missing token (or handshake 403 when closed before accept):
      // don't hammer, surface via offline state. Same if not logged in yet.
      onState(false);
      if ((e as CloseEvent).code === 4401) return;
      if (!getToken()) return;
      if (!stop) setTimeout(open, 2000);
    };
  };
  open();
  return () => { stop = true; ws?.close(); };
}
