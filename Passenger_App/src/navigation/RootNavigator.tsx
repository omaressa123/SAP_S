import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { useApp } from '../store/AppStore';
import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import BoardingPassScreen from '../screens/BoardingPassScreen';
import BaggageScreen from '../screens/BaggageScreen';
import WayfindingScreen from '../screens/WayfindingScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '✈',
  Pass: '🎫',
  Bags: '🧳',
  Map: '🗺',
  Alerts: '🔔',
  Profile: '👤',
};

export default function RootNavigator() {
  const { enrolled, alerts } = useApp();
  const unread = alerts.filter((a) => a.unread).length;

  if (!enrolled) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.tabBar, height: 64, paddingBottom: 8, paddingTop: 6 },
            tabBarActiveTintColor: colors.tabActive,
            tabBarInactiveTintColor: colors.tabInactive,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>{ICONS[route.name] ?? '•'}</Text>,
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Pass" component={BoardingPassScreen} options={{ title: 'Boarding' }} />
          <Tab.Screen name="Bags" component={BaggageScreen} options={{ title: 'Baggage' }} />
          <Tab.Screen name="Map" component={WayfindingScreen} options={{ title: 'Wayfinding' }} />
          <Tab.Screen
            name="Alerts"
            component={AlertsScreen}
            options={{ tabBarBadge: unread > 0 ? unread : undefined, tabBarBadgeStyle: { backgroundColor: colors.accent } }}
          />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
