import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertItem, Bag, Flight, Waypoint, mockWaypoints } from '../data/mock';
import { CacheStore, TokenStore } from '../services/storage';
import { JourneySnapshot, RestApi, subscribeJourneyRealtime } from '../services/api';

/**
 * APPLICATION LAYER — Authoritative Backend-Backed Passenger Journey State.
 */

interface AppState {
  enrolled: boolean;
  pairingBusy: boolean;
  pairingError: string | null;
  journey: JourneySnapshot | null;
  passengerName: string;
  flight: Flight;
  bags: Bag[];
  alerts: AlertItem[];
  waypoints: Waypoint[];
  offline: boolean;
  lastSyncedAt: string | null;
  pairWithQr: (qrPayload: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  markAllRead: () => void;
  setOffline: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

function mapFlightFromJourney(j: JourneySnapshot | null): Flight {
  const f = j?.flight;
  const b = j?.booking;
  const bp = j?.boarding_pass;
  const sched = f?.scheduled_departure ? new Date(f.scheduled_departure) : null;
  return {
    flightNo: f?.flight_number || '—',
    airline: f?.airline || 'Smart Airport',
    from: f?.origin_iata || '—',
    to: f?.destination_iata || '—',
    date: sched ? sched.toLocaleDateString() : '—',
    departure: sched ? sched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    arrival: '—',
    terminal: 'Terminal 1',
    gate: f?.boarding_gate || bp?.gate || 'TBD',
    boardingGroup: b?.booking_class || 'Economy',
    seat: b?.seat_number || bp?.seat || '—',
    status: (f?.status as Flight['status']) || 'Scheduled',
    qrPayload: bp?.qr_payload || j?.boarding_pass?.boarding_pass_code || j?.journey_id || '',
  };
}

function mapBagsFromJourney(j: JourneySnapshot | null): Bag[] {
  return (j?.bags || []).map((bg) => ({
    tag: bg.qr_code || bg.rfid_tag || `BAG-${bg.bag_id}`,
    flightNo: j?.flight?.flight_number || '—',
    weightKg: bg.weight_kg ?? 0,
    status: bg.status as Bag['status'],
    location: bg.carousel ? `${bg.location || 'Baggage Claim'} · ${bg.carousel}` : (bg.location || 'Processing'),
    lastSeen: bg.checkpoints?.[bg.checkpoints.length - 1]?.timestamp
      ? new Date(bg.checkpoints[bg.checkpoints.length - 1].timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'synced',
    progress: bg.progress,
  }));
}

function mapAlertsFromJourney(j: JourneySnapshot | null): AlertItem[] {
  return (j?.notifications || []).map((n) => ({
    id: n.id,
    title: n.type.replace(/^journey_/, '').replace(/_/g, ' ').toUpperCase(),
    body: n.content,
    time: n.sent_at ? new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now',
    severity: n.type.includes('delay') || n.type.includes('fail') ? 'warn' : 'info',
    unread: n.unread,
  }));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [enrolled, setEnrolled] = useState(false);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [journey, setJourney] = useState<JourneySnapshot | null>(null);
  const [waypoints] = useState<Waypoint[]>(mockWaypoints);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});

  const applyJourney = useCallback((snap: JourneySnapshot) => {
    setJourney(snap);
    setEnrolled(true);
    setLastSyncedAt(new Date().toLocaleTimeString());
    CacheStore.set('journey_snapshot', snap);
  }, []);

  const refresh = useCallback(async () => {
    const token = await TokenStore.getToken();
    if (!token) {
      setEnrolled(false);
      return;
    }
    if (offline) {
      const cached = await CacheStore.get<JourneySnapshot>('journey_snapshot');
      if (cached) applyJourney(cached);
      return;
    }
    try {
      const snap = await RestApi.getMyJourney(token);
      applyJourney(snap);
    } catch {
      const cached = await CacheStore.get<JourneySnapshot>('journey_snapshot');
      if (cached) applyJourney(cached);
    }
  }, [offline, applyJourney]);

  // Restore persisted session on app restart
  useEffect(() => {
    (async () => {
      const token = await TokenStore.getToken();
      if (!token) return;
      const cached = await CacheStore.get<JourneySnapshot>('journey_snapshot');
      if (cached) applyJourney(cached);
      await refresh();
    })();
  }, [refresh, applyJourney]);

  // Real-time WebSocket + fallback periodic sync
  useEffect(() => {
    if (!enrolled || !journey?.journey_id || offline) return;
    const unsub = subscribeJourneyRealtime(journey.journey_id, (snap) => {
      applyJourney(snap);
    });
    const poll = setInterval(() => {
      refresh();
    }, 10000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [enrolled, journey?.journey_id, offline, applyJourney, refresh]);

  const pairWithQr = useCallback(async (qrPayload: string) => {
    setPairingBusy(true);
    setPairingError(null);
    try {
      const deviceUuid = await TokenStore.getOrCreateDeviceUuid();
      const res = await RestApi.pairWithQr(qrPayload, deviceUuid);
      await TokenStore.saveSession(
        res.access_token,
        String(res.journey.passenger.passenger_id),
        res.journey.journey_id,
      );
      applyJourney(res.journey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'QR pairing failed.';
      setPairingError(msg);
      throw err;
    } finally {
      setPairingBusy(false);
    }
  }, [applyJourney]);

  const logout = useCallback(async () => {
    await TokenStore.clear();
    await CacheStore.clearJourneyCache();
    setJourney(null);
    setEnrolled(false);
    setPairingError(null);
  }, []);

  const markAllRead = useCallback(() => {
    const next: Record<string, boolean> = {};
    (journey?.notifications || []).forEach((n) => {
      next[n.id] = true;
    });
    setReadIds(next);
  }, [journey]);

  const passengerName = journey?.passenger?.full_name || 'Passenger';
  const flight = useMemo(() => mapFlightFromJourney(journey), [journey]);
  const bags = useMemo(() => mapBagsFromJourney(journey), [journey]);
  const alerts = useMemo(
    () => mapAlertsFromJourney(journey).map((a) => (readIds[a.id] ? { ...a, unread: false } : a)),
    [journey, readIds],
  );

  const value = useMemo<AppState>(
    () => ({
      enrolled,
      pairingBusy,
      pairingError,
      journey,
      passengerName,
      flight,
      bags,
      alerts,
      waypoints,
      offline,
      lastSyncedAt,
      pairWithQr,
      logout,
      refresh,
      markAllRead,
      setOffline,
    }),
    [enrolled, pairingBusy, pairingError, journey, passengerName, flight, bags, alerts, waypoints, offline, lastSyncedAt, pairWithQr, logout, refresh, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
