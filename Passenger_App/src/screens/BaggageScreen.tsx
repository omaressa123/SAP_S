import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import { Card, SectionTitle, StatusPill } from '../components/ui';
import { AnimatedProgress, Enter, LiveDot, Pulse } from '../components/anim';
import { useApp } from '../store/AppStore';
import type { Bag } from '../data/mock';

const STAGES = ['Check-in', 'Security', 'Sorting', 'Aircraft', 'Arrived'] as const;

function stageIndex(b: Bag): number {
  switch (b.status) {
    case 'Checked-in': return 0;
    case 'In Transit': return 2;
    case 'Loading': return 3;
    case 'On Belt 4': return 4;
    default: return 1;
  }
}

function BagTimeline({ bag, index }: { bag: Bag; index: number }) {
  const active = stageIndex(bag);
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(lineAnim, {
      toValue: active / (STAGES.length - 1),
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [lineAnim, active]);

  const lineHeight = lineAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Enter delay={index * 120}>
      <Card style={{ marginBottom: spacing.md }}>
        <View style={styles.headRow}>
          <StatusPill label={bag.status} tone={bag.status === 'On Belt 4' ? 'ok' : 'info'} />
          <LiveDot color={bag.status === 'On Belt 4' ? colors.success : colors.info} />
        </View>
        <Text style={styles.tag}>{bag.tag} · {bag.flightNo}</Text>
        <Text style={styles.loc}>{bag.location} · {bag.lastSeen}</Text>

        {/* Animated vertical journey */}
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
        <Text style={styles.pct}>{Math.round(bag.progress * 100)}% to aircraft</Text>
      </Card>
    </Enter>
  );
}

export default function BaggageScreen() {
  const { bags } = useApp();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle title="Baggage Tracker" right="Live status" />
      </Enter>
      {bags.map((b, i) => (
        <BagTimeline key={b.tag} bag={b} index={i} />
      ))}
      <Enter delay={bags.length * 120 + 80}>
        <Card>
          <Text style={styles.note}>Checked-in → Security → Sorting → Aircraft → Arrived. Updates arrive via realtime events + push.</Text>
        </Card>
      </Enter>
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
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  node: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.divider,
  },
  nodeDone: { backgroundColor: '#DFF0E7', borderColor: colors.success },
  nodeCurrent: { backgroundColor: '#DCE4EF', borderColor: colors.info, borderWidth: 2 },
  nodeIcon: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  stageLabel: { ...typography.body, color: colors.textMuted, marginLeft: 10 },
  stageCurrent: { color: colors.textPrimary, fontWeight: '800' },
  stageDone: { color: colors.textSecondary },
});
