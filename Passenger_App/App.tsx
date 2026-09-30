import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/store/AppStore';
import RootNavigator from './src/navigation/RootNavigator';

/**
 * Passenger App — React Native (Expo 57)
 * Presentation layer:
 * Onboarding/Login+Face, Home/My Flight, Boarding Pass, Baggage,
 * Wayfinding, Alerts, Profile.
 * Passenger-only services via API Gateway: Identity, Flights,
 * Boarding, Baggage, Wayfinding, Notifications.
 * (Energy Management lives in Airport Operations / Digital Twin —
 *  intentionally NOT referenced here.)
 * Theme: themes1.jpeg (navy / slate / dusty blue / mist / taupe / sand).
 */
export default function App() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AppProvider>
  );
}
