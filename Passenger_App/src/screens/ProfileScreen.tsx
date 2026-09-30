import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, SectionTitle } from '../components/ui';
import { Enter } from '../components/anim';
import { useApp } from '../store/AppStore';

export default function ProfileScreen() {
  const { passengerName, flight, offline, setOffline, logout } = useApp();
  const [push, setPush] = React.useState(true);
  const [biometric, setBiometric] = React.useState(true);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle title="Profile & Settings" right={flight.flightNo} />
      </Enter>
      <Enter delay={90}>
        <Card>
          <Text style={styles.name}>{passengerName}</Text>
          <Text style={styles.sub}>PAX-001 · {flight.from} → {flight.to} · Face enrolled ✓</Text>
        </Card>
      </Enter>

      <Enter delay={180}>
        <Card style={{ marginTop: spacing.md }}>
          <Row label="Push notifications" value={push} onChange={setPush} />
          <Row label="Face ID boarding" value={biometric} onChange={setBiometric} />
          <Row label="Offline mode (last known data)" value={offline} onChange={setOffline} />
        </Card>
      </Enter>

      <Enter delay={260}>
        <Text style={styles.logout} onPress={logout}>Log out / switch passenger</Text>
        <Text style={styles.ver}>Passenger App 1.0.0 · Expo 57 · gateway: identity / flights / boarding / baggage / wayfinding / notifications</Text>
      </Enter>
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.divider }} thumbColor={value ? colors.primary : '#fff'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  name: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  logout: { color: colors.danger, fontWeight: '700', textAlign: 'center', marginTop: 20 },
  ver: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
});
