import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Card, SectionTitle, StatusPill } from '../components/ui';
import { Enter, LiveDot, Pulse, RoutePlane } from '../components/anim';
import { useApp } from '../store/AppStore';

const TIMELINE_TONE: Record<string, { dot: string; label: string; badge: 'ok' | 'info' | 'warn' }> = {
  completed: { dot: colors.success, label: 'Completed', badge: 'ok' },
  in_progress: { dot: colors.info, label: 'In Progress', badge: 'info' },
  delayed: { dot: colors.warning, label: 'Delayed', badge: 'warn' },
  failed: { dot: colors.danger, label: 'Failed', badge: 'warn' },
  upcoming: { dot: colors.textMuted, label: 'Upcoming', badge: 'info' },
};

export default function HomeScreen() {
  const { journey, flight, passengerName, offline, lastSyncedAt, refresh } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const timeline = journey?.timeline || [];
  const nextStage = timeline.find((t) => t.status === 'in_progress' || t.status === 'upcoming');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Enter delay={0}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <Text style={styles.kicker}>MY JOURNEY · LIVE STATUS</Text>
            <LiveDot color={colors.highlight} />
          </View>
          <Text style={styles.title}>Hello, {passengerName}</Text>
          <Text style={styles.sub}>
            {flight.flightNo} · {flight.from} → {flight.to} · {flight.date}
            {offline ? ' · OFFLINE (last known)' : lastSyncedAt ? ` · synced ${lastSyncedAt}` : ''}
          </Text>
          <View style={styles.countdownRow}>
            <Text style={styles.countdownLabel}>BOARDING TIME</Text>
            <Text style={styles.countdown}>{journey?.flight?.boarding_time || flight.departure || '—'}</Text>
          </View>
        </View>
      </Enter>

      <Enter delay={110}>
        <Card>
          <View style={styles.row}>
            <View>
              <Text style={styles.big}>{flight.departure}</Text>
              <Text style={styles.muted}>{flight.from} · {journey?.flight?.origin_city || flight.terminal}</Text>
            </View>
            <View style={styles.route}>
              <View style={styles.line} />
              <RoutePlane />
              <View style={styles.line} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.big}>{flight.arrival !== '—' ? flight.arrival : (journey?.flight?.destination_iata || flight.to)}</Text>
              <Text style={styles.muted}>{journey?.flight?.destination_city || flight.to}</Text>
            </View>
          </View>
          <Text style={styles.routeLabels}>
            {journey?.flight?.airline || flight.airline} · {journey?.booking?.booking_reference || 'PNR'}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.statusRow}>
              <StatusPill label={flight.status} tone={flight.status.toUpperCase() === 'BOARDING' ? 'warn' : 'ok'} />
              <View style={{ width: 8 }} />
              <LiveDot color={colors.success} />
            </View>
            <Pulse>
              <Text style={styles.meta}>Gate {flight.gate} · Seat {flight.seat}</Text>
            </Pulse>
          </View>
        </Card>
      </Enter>

      <Enter delay={200}>
        <SectionTitle
          title="Passenger Journey Timeline"
          right={nextStage ? `Next: ${nextStage.label}` : 'Journey Complete'}
        />
      </Enter>

      <Enter delay={280}>
        <Card>
          {timeline.map((step, idx) => {
            const meta = TIMELINE_TONE[step.status] || TIMELINE_TONE.upcoming;
            return (
              <View key={step.stage} style={styles.tlRow}>
                <View style={styles.tlRailCol}>
                  <View style={[styles.tlDot, { backgroundColor: meta.dot }]} />
                  {idx < timeline.length - 1 && <View style={styles.tlLine} />}
                </View>
                <View style={styles.tlBody}>
                  <View style={styles.tlHead}>
                    <Text style={step.status === 'completed' || step.status === 'in_progress' ? styles.stepBold : styles.step}>
                      {step.label}
                    </Text>
                    <Text style={[styles.tlState, { color: meta.dot }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.tlMeta}>
                    {step.location ? `${step.location} · ` : ''}
                    {step.timestamp ? new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : step.next_action}
                  </Text>
                </View>
              </View>
            );
          })}
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
  step: { ...typography.body, color: colors.textSecondary },
  stepBold: { ...typography.bodyBold, color: colors.textPrimary },
  tlRow: { flexDirection: 'row', minHeight: 46 },
  tlRailCol: { width: 22, alignItems: 'center' },
  tlDot: { width: 11, height: 11, borderRadius: 6, marginTop: 4 },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.divider, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 10, paddingLeft: 6 },
  tlHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tlState: { fontSize: 11, fontWeight: '800' },
  tlMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
