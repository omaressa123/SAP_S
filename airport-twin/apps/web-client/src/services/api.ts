import type { Asset } from '../assets/registry';

const j = (u: string) => fetch(u).then((r) => {
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
  let ws: WebSocket | null = null, stop = false, reconnectTimer: number | null = null;
  const open = () => {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${scheme}://${location.host}/ws/twin`);
    ws.onopen = () => { onState(true); };
    ws.onmessage = (m) => onEvent(JSON.parse(m.data));
    ws.onclose = (e) => {
      onState(false);
      if (!stop) reconnectTimer = window.setTimeout(open, 2000);
    };
  };
  open();
  return () => { stop = true; if (reconnectTimer) window.clearTimeout(reconnectTimer); ws?.close(); };
}
