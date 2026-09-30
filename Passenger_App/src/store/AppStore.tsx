import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertItem, Bag, Flight, Waypoint, mockAlerts, mockBags, mockFlight, mockWaypoints } from '../data/mock';
import { CacheStore, TokenStore } from '../services/storage';
import { RestApi, subscribeRealtime } from '../services/api';

/**
 * APPLICATION LAYER — State Management (View Models) + Offline Mode + Sync.
 */

interface AppState {
  enrolled: boolean;
  passengerName: string;
  flight: Flight;
  bags: Bag[];
  alerts: AlertItem[];
  waypoints: Waypoint[];
  offline: boolean;
  lastSyncedAt: string | null;
  enroll: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  markAllRead: () => void;
  setOffline: (v: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [enrolled, setEnrolled] = useState(true); // default true so tabs are visible on first run
  const [passengerName, setPassengerName] = useState('Guest Traveler');
  const [flight, setFlight] = useState<Flight>(mockFlight);
  const [bags, setBags] = useState<Bag[]>(mockBags);
  const [alerts, setAlerts] = useState<AlertItem[]>(mockAlerts);
  const [waypoints] = useState<Waypoint[]>(mockWaypoints);
  const [offline, setOffline] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (offline) {
      const [f, b, a] = await Promise.all([
        CacheStore.get<Flight>('flight'),
        CacheStore.get<Bag[]>('bags'),
        CacheStore.get<AlertItem[]>('alerts'),
      ]);
      if (f) setFlight(f);
      if (b) setBags(b);
      if (a) setAlerts(a);
      return;
    }
    const [f, b, a] = await Promise.all([RestApi.getFlight(), RestApi.getBags(), RestApi.getAlerts()]);
    setFlight(f);
    setBags(b);
    setAlerts(a);
    setLastSyncedAt(new Date().toLocaleTimeString());
  }, [offline]);

  useEffect(() => {
    refresh();
    const unsub = subscribeRealtime((e) => {
      if (e.type === 'bag-update') {
        setBags((prev) => prev.map((bg) => (bg.tag === e.tag ? { ...bg, status: e.status as Bag['status'], progress: e.progress, lastSeen: 'just now' } : bg)));
      }
    });
    TokenStore.getToken().then((t) => {
      if (t) setEnrolled(true);
    });
    return unsub;
  }, [refresh]);

  const enroll = useCallback(async (name: string) => {
    await TokenStore.saveSession(`demo-token-${Date.now()}`, 'PAX-001');
    setPassengerName(name.trim() || 'Guest Traveler');
    setEnrolled(true);
  }, []);

  const logout = useCallback(async () => {
    await TokenStore.clear();
    setEnrolled(false);
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false })));
  }, []);

  const value = useMemo<AppState>(
    () => ({ enrolled, passengerName, flight, bags, alerts, waypoints, offline, lastSyncedAt, enroll, logout, refresh, markAllRead, setOffline }),
    [enrolled, passengerName, flight, bags, alerts, waypoints, offline, lastSyncedAt, enroll, logout, refresh, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
