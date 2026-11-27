import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { Card, SectionTitle, StatusPill } from '../components/ui';
import { AnimatedProgress, Enter, LiveDot, Pulse } from '../components/anim';
import { useApp } from '../store/AppStore';
import type { Bag } from '../data/mock';

const STAGES = [
  'Registered',
  'Accepted at Baggage Drop',
  'In Processing',
  'Security Screening',
  'Loaded',
  'In Transit',
  'Arrived at Destination',
  'Transferred to Baggage Carousel',
  'Ready for Collection',
  'Collected',
] as const;

function stageIndex(b: Bag): number {
  const idx = STAGES.findIndex((s) => s.toLowerCase() === String(b.status).toLowerCase());
  if (idx >= 0) return idx;
  return Math.min(STAGES.length - 1, Math.max(0, Math.round(b.progress * (STAGES.length - 1))));
}

function BagTimeline({ bag, index }: { bag: Bag; index: number }) {
  const active = stageIndex(bag);
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(lineAnim, {
      toValue: active / (STAGES.length - 1),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [lineAnim, active]);

  const lineHeight = lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const isReady = bag.status === 'Ready for Collection' || bag.status === 'Collected';

  return (
    <Enter delay={index * 120}>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={styles.headRow}>
          <StatusPill label={bag.status} tone={isReady ? 'ok' : 'info'} />
          <LiveDot color={isReady ? colors.success : colors.info} />
        </View>
        <Text style={styles.tag}>{bag.tag} · {bag.flightNo}</Text>
        <Text style={styles.loc}>{bag.location} · {bag.lastSeen}</Text>

        <View style={styles.timeline}>
          <View style={styles.rail}>
            <Animated.View style={[styles.railFill, { height: lineHeight }]} />
          </View>
          <View style={styles.stages}>
            {STAGES.map((s, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <View key={s} style={styles.stageRow}>
                  {current ? (
                    <Pulse>
                      <View style={[styles.node, styles.nodeCurrent]}>
                        <Text style={styles.nodeIcon}>🧳</Text>
                      </View>
                    </Pulse>
                  ) : (
                    <View style={[styles.node, done && styles.nodeDone]}>
                      <Text style={styles.nodeIcon}>{done ? '✓' : '·'}</Text>
                    </View>
                  )}
                  <Text style={[styles.stageLabel, current && styles.stageCurrent, done && styles.stageDone]}>
                    {s}{current ? '  ● live' : done ? '  ✓' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <AnimatedProgress value={bag.progress} color={colors.info} />
        <Text style={styles.pct}>{Math.round(bag.progress * 100)}% journey progress</Text>
      </Card>
    </Enter>
  );
}

export default function BaggageScreen() {
  const { bags, journey } = useApp();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle
          title="Baggage Tracker"
          right={journey?.baggage_carousel ? `Carousel ${journey.baggage_carousel}` : `${bags.length} Bag(s)`}
        />
      </Enter>
      {bags.length === 0 ? (
        <Card>
          <Text style={styles.note}>No checked baggage registered yet. Drop your bags at AeroGate Self-Drop to begin tracking.</Text>
        </Card>
      ) : (
        bags.map((b, i) => <BagTimeline key={b.tag} bag={b} index={i} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  loc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  pct: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
  note: { fontSize: 13, color: colors.textSecondary },
  timeline: { flexDirection: 'row', marginTop: 14, marginBottom: 6 },
  rail: { width: 4, borderRadius: 4, backgroundColor: 'rgba(7,23,57,0.10)', marginLeft: 14, overflow: 'hidden' },
  railFill: { width: 4, borderRadius: 4, backgroundColor: colors.info },
  stages: { flex: 1, marginLeft: 12 },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  node: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.divider,
  },
  nodeDone: { backgroundColor: '#DFF0E7', borderColor: colors.success },
  nodeCurrent: { backgroundColor: '#DCE4EF', borderColor: colors.info, borderWidth: 2 },
  nodeIcon: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  stageLabel: { ...typography.caption, color: colors.textMuted, marginLeft: 10 },
  stageCurrent: { color: colors.textPrimary, fontWeight: '800' },
  stageDone: { color: colors.textSecondary },
});
