import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Card, SectionTitle, StatusPill } from '../components/ui';
import { Enter, LiveDot, Pulse, RoutePlane } from '../components/anim';
import { useApp } from '../store/AppStore';

function useBoardingCountdown(initialSecs = 24 * 60 + 40) {
  const [secs, setSecs] = useState(initialSecs);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : initialSecs)), 1000);
    return () => clearInterval(t);
  }, [initialSecs]);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const { flight, passengerName, offline, lastSyncedAt, refresh } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const countdown = useBoardingCountdown();

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Enter delay={0}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.kicker}>MY FLIGHT · LIVE STATUS</Text>
            <LiveDot color={colors.highlight} />
          </View>
          <Text style={styles.title}>Hello, {passengerName}</Text>
          <Text style={styles.sub}>
            {flight.flightNo} · {flight.from} → {flight.to} · {flight.date}
            {offline ? ' · OFFLINE (last known)' : lastSyncedAt ? ` · synced ${lastSyncedAt}` : ''}
          </Text>
          <View style={styles.countdownRow}>
            <Text style={styles.countdownLabel}>BOARDING IN</Text>
            <Text style={styles.countdown}>{countdown}</Text>
          </View>
        </View>
      </Enter>

      <Enter delay={110}>
        <Card>
          <View style={styles.row}>
            <View>
              <Text style={styles.big}>{flight.departure}</Text>
              <Text style={styles.muted}>{flight.from} · {flight.terminal}</Text>
            </View>
            <View style={styles.route}>
              <View style={styles.line} />
              <RoutePlane />
              <View style={styles.line} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.big}>{flight.arrival}</Text>
              <Text style={styles.muted}>{flight.to}</Text>
            </View>
          </View>
          <Text style={styles.routeLabels}>Cairo ─────── London</Text>
          <View style={styles.metaRow}>
            <View style={styles.statusRow}>
              <StatusPill label={flight.status} tone={flight.status === 'Boarding' ? 'warn' : 'ok'} />
              <View style={{ width: 8 }} />
              <LiveDot color={colors.success} />
            </View>
            <Pulse>
              <Text style={styles.meta}>Gate {flight.gate} · Seat {flight.seat} · {flight.boardingGroup}</Text>
            </Pulse>
          </View>
        </Card>
      </Enter>

      <Enter delay={220}>
        <SectionTitle title="Journey" right="Terminal map synced" />
      </Enter>
      <Enter delay={300}>
        <Card>
          <Text style={styles.step}>1 · Check-in complete ✓</Text>
          <Text style={styles.step}>2 · Security 2 — 3 min walk</Text>
          <Text style={styles.stepBold}>3 · Board at Gate {flight.gate} — Group 2 now</Text>
        </Card>
      </Enter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  hero: { backgroundColor: colors.header, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: colors.highlight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { ...typography.title, color: colors.textOnDark, marginTop: 6 },
  sub: { ...typography.caption, color: colors.tabInactive, marginTop: 6 },
  countdownRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  countdownLabel: { color: colors.tabInactive, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  countdown: { color: colors.highlight, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  big: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  muted: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  route: { flexDirection: 'row', alignItems: 'center', flex: 1, marginHorizontal: 12 },
  line: { flex: 1, height: 2, backgroundColor: colors.divider, borderRadius: 2 },
  routeLabels: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { ...typography.caption, color: colors.textSecondary },
  step: { ...typography.body, color: colors.textSecondary, marginVertical: 3 },
  stepBold: { ...typography.bodyBold, color: colors.textPrimary, marginVertical: 3 },
});
