# Passenger App — Mobile Workflow (React Native + Expo 57)

## 1. Prereqs
- Node 20+ (`node -v`), npm 10+
- Expo Go on a physical device (same Wi-Fi as dev machine), or Android Studio / Xcode for emulators
- No backend required for UI work — app runs on mock data with cache fallback

## 2. Install
```bash
cd Passenger_App
npm install
```

## 3. Configure (optional)
| Variable | Purpose | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | API Gateway base URL used by `src/services/api.ts` | `https://gateway.example.com` |

```bash
export EXPO_PUBLIC_API_URL=https://gateway.example.com
```
Until backends are live, `RestApi` resolves mock data through the same cache path, so screens work unchanged.

## 4. Run
```bash
npx expo start        # dev server + QR for Expo Go
npx expo start --android
npx expo start --ios  # macOS / simulator, or Expo Go on iPhone
```
Offline smoke test (verifies Metro bundles without network):
```bash
npx expo start --offline
```

## 5. Dev loop (per screen)
1. Edit under `src/` (screens are independent — see map below)
2. `npx tsc --noEmit` — must be clean before considering work done
3. Reload in Expo Go (`r`) or emulator; pull-to-refresh on Home re-runs `refresh()`
4. Toggle **Profile → Offline mode** to verify last-known-data behavior

## 6. Project map (system design → code)
| Design layer | Code |
|---|---|
| Presentation (8 screens) | `src/screens/` — Onboarding, Home, BoardingPass, Baggage, Wayfinding, Alerts, Green, Profile |
| Navigation | `src/navigation/RootNavigator.tsx` (bottom tabs; onboarding gate when logged out) |
| State (view models) | `src/store/AppStore.tsx` (`useApp`: flight, bags, alerts, offline, enroll/logout, refresh) |
| Local cache + secure storage | `src/services/storage.ts` (`CacheStore` = AsyncStorage, `TokenStore` = SecureStore) |
| REST / realtime / push | `src/services/api.ts` (`RestApi`, `subscribeRealtime`, `PushHandler.registerToken`) |
| Theme (`themes1.jpeg`) | `src/theme.ts` (`palette` + `colors` + spacing/radius/typography) |
| Shared UI | `src/components/ui.tsx` (Card, buttons, StatusPill, ProgressBar) |
| Mock data | `src/data/mock.ts` |

Theme tokens: navy `#071739`, slate `#4B6382`, dusty `#A4B5C4`, mist `#CDD5DB`, taupe `#A68868`, sand `#E3C39D`. Use `colors.*` — never hardcode hex in screens.

## 7. Going live (backend wiring checklist)
1. Point `EXPO_PUBLIC_API_URL` at the gateway
2. `src/services/api.ts` → replace mock resolvers with `fetch(${BASE_URL}/flights|bags|alerts|waypoints|energy)` + auth header from `TokenStore.getToken()`
3. `subscribeRealtime` → WebSocket/SSE to gateway; keep the same `RealtimeEvent` shapes
4. `PushHandler.registerToken` → POST push token; add `expo-notifications` + FCM/APNs credentials in `app.json`
5. Face enrollment (`OnboardingScreen`) → wire device biometrics / DeepFace service; keep template on-device, token in SecureStore

## 8. Verify
```bash
npx tsc --noEmit
npx expo start --offline   # expect "Starting Metro Bundler / Waiting on http://localhost:8081"
```

## 9. Build / release (when needed)
```bash
npm i -g eas-cli && eas init
eas build -p android --profile preview
eas build -p ios --profile preview
eas submit -p android   # / ios — after store credentials are set
```
Bump `version` in `app.json` + `package.json` per release.

## 10. Troubleshooting
| Symptom | Fix |
|---|---|
| `Unable to resolve module` | `rm -rf node_modules && npm install`, restart with `npx expo start -c` |
| SecureStore error on web/simulator | Expected — falls back to in-memory store; test auth on a real device |
| Stale data on screen | Pull-to-refresh on Home, or clear app storage; check `lastSyncedAt` subtitle |
| Port 8081 busy | `npx expo start --port 8082` |
