import { CacheStore } from './storage';
import { mockAlerts, mockBags, mockFlight, mockWaypoints } from '../data/mock';

/**
 * NETWORK / REALTIME LAYER (mock-backed, gateway-ready)
 * - RestApi: REST API Client -> API Gateway -> backend services
 * - Realtime: WebSocket / SSE client (simulated with polling hooks in screens)
 * - Push: FCM/APNs handler stub
 *
 * Replace BASE_URL + fetch paths with the real gateway when backends are live.
 * Every call caches last-known data so Offline Mode + Sync keeps working.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://gateway.example.com';

async function withCache<T>(key: string, fetcher: () => Promise<T>, fallback: T): Promise<T> {
  try {
    // In production: const res = await fetch(`${BASE_URL}...`);
    // Here we resolve mock data through the same cache path.
    const data = await fetcher();
    await CacheStore.set(key, data);
    return data;
  } catch {
    const cached = await CacheStore.get<T>(key);
    return cached ?? fallback;
  }
}

export const RestApi = {
  baseUrl: BASE_URL,
  getFlight: () => withCache('flight', async () => mockFlight, mockFlight),
  getBags: () => withCache('bags', async () => mockBags, mockBags),
  getAlerts: () => withCache('alerts', async () => mockAlerts, mockAlerts),
  getWaypoints: () => withCache('waypoints', async () => mockWaypoints, mockWaypoints),
};

export type RealtimeEvent =
  | { type: 'flight-status'; status: string; gate: string }
  | { type: 'bag-update'; tag: string; status: string; progress: number }
  | { type: 'safety'; title: string; body: string };

/** Simulated realtime subscription (swap for WebSocket/SSE later). */
export function subscribeRealtime(onEvent: (e: RealtimeEvent) => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  timers.push(
    setTimeout(() => onEvent({ type: 'bag-update', tag: 'BG-88210', status: 'Loading', progress: 0.86 }), 8000),
  );
  timers.push(
    setTimeout(() => onEvent({ type: 'flight-status', status: 'Boarding', gate: 'B12' }), 14000),
  );
  return () => timers.forEach(clearTimeout);
}

export const PushHandler = {
  /** Wire expo-notifications / FCM / APNs token registration here. */
  async registerToken(token: string): Promise<void> {
    // POST ${BASE_URL}/notifications/register { token }
    await CacheStore.set('push_token', token);
  },
};
