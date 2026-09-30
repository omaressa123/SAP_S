import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * APPLICATION LAYER — Local Cache (Flight / Bag / Map) + Secure Storage (Token / Session)
 * Mirrors the system-design boxes: Local Cache, Secure Storage, Offline Mode + Sync.
 */

const MEMORY_FALLBACK = new Map<string, string>();

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    MEMORY_FALLBACK.set(`secure:${key}`, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v !== null) return v;
  } catch {
    // fall through to memory
  }
  return MEMORY_FALLBACK.get(`secure:${key}`) ?? null;
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
  MEMORY_FALLBACK.delete(`secure:${key}`);
}

export const TokenStore = {
  async saveSession(token: string, passengerId: string): Promise<void> {
    await secureSet('session_token', token);
    await secureSet('passenger_id', passengerId);
  },
  async getToken(): Promise<string | null> {
    return secureGet('session_token');
  },
  async clear(): Promise<void> {
    await secureDelete('session_token');
    await secureDelete('passenger_id');
  },
};

export const CacheStore = {
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(`cache:${key}`, JSON.stringify({ value, ts: Date.now() }));
    } catch {
      MEMORY_FALLBACK.set(`cache:${key}`, JSON.stringify({ value, ts: Date.now() }));
    }
  },
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`cache:${key}`);
      if (!raw) return MEMORY_FALLBACK.has(`cache:${key}`)
        ? (JSON.parse(MEMORY_FALLBACK.get(`cache:${key}`)!) as { value: T }).value
        : null;
      return (JSON.parse(raw) as { value: T }).value;
    } catch {
      return null;
    }
  },
};
