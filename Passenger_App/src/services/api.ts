import { CacheStore } from './storage';
import { mockWaypoints } from '../data/mock';

/**
 * NETWORK / REALTIME LAYER — Connected to FastAPI Backend & WebSocket.
 */

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export interface JourneyPassenger {
  passenger_id: number;
  full_name: string;
  nationality?: string | null;
  document_type?: string | null;
  document_number_masked?: string | null;
  biometric_consent?: boolean;
  photo_url?: string | null;
}

export interface JourneyBooking {
  booking_id?: number | null;
  booking_reference?: string | null;
  seat_number?: string | null;
  booking_class?: string | null;
  booking_status?: string | null;
}

export interface JourneyFlight {
  flight_id?: number | null;
  flight_number?: string | null;
  airline?: string | null;
  airline_iata?: string | null;
  origin_iata?: string | null;
  origin_city?: string | null;
  destination_iata?: string | null;
  destination_city?: string | null;
  scheduled_departure?: string | null;
  actual_departure?: string | null;
  boarding_gate?: string | null;
  boarding_time?: string | null;
  status: string;
}

export interface JourneyBoardingPass {
  boarding_pass_code?: string | null;
  passenger_name: string;
  flight_number?: string | null;
  seat?: string | null;
  gate?: string | null;
  boarding_time?: string | null;
  qr_payload?: string | null;
}

export interface JourneyBag {
  bag_id: number;
  rfid_tag?: string | null;
  qr_code?: string | null;
  weight_kg?: number | null;
  status: string;
  status_key: string;
  progress: number;
  location?: string | null;
  carousel?: string | null;
  checkpoints: Array<{ checkpoint_type: string; location: string; timestamp?: string | null }>;
}

export interface JourneyTimelineStage {
  stage: string;
  label: string;
  status: 'completed' | 'in_progress' | 'upcoming' | 'delayed' | 'failed';
  timestamp?: string | null;
  location?: string | null;
  details?: Record<string, unknown>;
  next_action: string;
}

export interface JourneyNotification {
  id: string;
  type: string;
  content: string;
  sent_at?: string | null;
  unread: boolean;
}

export interface JourneySnapshot {
  journey_id: string;
  current_stage: string;
  journey_status: string;
  baggage_carousel?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  passenger: JourneyPassenger;
  booking: JourneyBooking;
  flight: JourneyFlight;
  boarding_pass: JourneyBoardingPass;
  bags: JourneyBag[];
  timeline: JourneyTimelineStage[];
  notifications: JourneyNotification[];
}

export interface PairClaimResponse {
  access_token: string;
  token_type: string;
  journey: JourneySnapshot;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    const msg = body?.error?.message || body?.detail || `HTTP ${res.status} on ${path}`;
    throw new Error(msg);
  }
  return (body?.data ?? body) as T;
}

export const RestApi = {
  baseUrl: BASE_URL,

  pairWithQr: (token: string, deviceUuid: string, pushToken?: string): Promise<PairClaimResponse> =>
    requestJson<PairClaimResponse>('/api/v1/journey/pair/claim', {
      method: 'POST',
      body: JSON.stringify({
        token,
        device_uuid: deviceUuid,
        device_type: 'expo_mobile',
        push_token: pushToken,
        app_version: '1.0.0',
      }),
    }),

  getMyJourney: async (jwt: string): Promise<JourneySnapshot> => {
    const snap = await requestJson<JourneySnapshot>('/api/v1/journey/me', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    await CacheStore.set('journey_snapshot', snap);
    return snap;
  },

  registerPushToken: async (jwt: string, pushToken: string): Promise<void> => {
    await requestJson('/api/v1/journey/device/push-token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ push_token: pushToken }),
    });
  },

  getWaypoints: () => CacheStore.get('waypoints').then((c) => c ?? mockWaypoints),
};

export function subscribeJourneyRealtime(
  journeyId: string,
  onJourneyUpdate: (snapshot: JourneySnapshot) => void,
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed || !journeyId) return;
    try {
      const wsBase = BASE_URL.replace(/^http/i, 'ws');
      ws = new WebSocket(`${wsBase}/api/v1/journey/ws/${encodeURIComponent(journeyId)}`);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data));
          if (msg?.type === 'journey_update' && msg.journey) {
            onJourneyUpdate(msg.journey as JourneySnapshot);
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (!closed) {
          retryTimer = setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      retryTimer = setTimeout(connect, 5000);
    }
  };

  connect();
  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    ws?.close();
  };
}
