import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, palette, radius, spacing, typography } from '../theme';
import { Card, SectionTitle } from '../components/ui';
import { Enter, LiveDot, Pulse } from '../components/anim';
import { useApp } from '../store/AppStore';

const dotColor: Record<string, string> = {
  Gate: colors.primary,
  Security: colors.danger,
  Lounge: colors.accent,
  Food: colors.accent,
  Baggage: colors.secondary,
  Exit: colors.success,
};

/** Smoothly tweens a displayed number toward its target. */
function useTweenNumber(target: number, duration = 700) {
  const [display, setDisplay] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    const delta = target - start;
    if (delta === 0) return;
    const t0 = Date.now();
    const tick = setInterval(() => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = start + delta * eased;
      setDisplay(Math.round(v));
      if (t >= 1) {
        from.current = target;
        clearInterval(tick);
      }
    }, 30);
    return () => clearInterval(tick);
  }, [target, duration]);
  return display;
}

export default function WayfindingScreen() {
  const { waypoints, flight } = useApp();
  const [selectedId, setSelectedId] = useState('w2');
  const selected = waypoints.find((w) => w.id === selectedId) ?? waypoints[0];
  const walkMins = useTweenNumber(selected.walkMins);

  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, selectedId]);

  const routeWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const markerScale = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.15, 1] });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle title="Airport Wayfinding" right={`Terminal map · Gate ${flight.gate}`} />
      </Enter>

      <Enter delay={90}>
        <View style={styles.map}>
          <View style={styles.mapHead}>
            <Text style={styles.mapTitle}>T2 · Level 2 — route to {selected.name}</Text>
            <LiveDot color={colors.highlight} />
          </View>

          {/* Animated route: YOU ● ──▶ destination */}
          <View style={styles.routeRow}>
            <View style={styles.youWrap}>
              <View style={styles.youDot} />
              <Text style={styles.youLabel}>YOU</Text>
            </View>
            <View style={styles.track}>
              <Animated.View style={[styles.trackFill, { width: routeWidth }]} />
            </View>
            <Animated.View style={{ transform: [{ scale: markerScale }] }}>
              <Pulse>
                <View style={styles.destDot} />
              </Pulse>
            </Animated.View>
          </View>
          <Text style={styles.destLabel}>{selected.name}</Text>

          <Text style={styles.mapSub}>You → Security 2 (3 min) → {selected.name} (~{walkMins} min)</Text>
          <View style={styles.walkBadge}>
            <Text style={styles.walkText}>🚶 {walkMins} min walk</Text>
          </View>
        </View>
      </Enter>

      {waypoints.map((w, i) => {
        const active = w.id === selectedId;
        return (
          <Enter key={w.id} delay={160 + i * 80}>
            <TouchableOpacity onPress={() => setSelectedId(w.id)} activeOpacity={0.7}>
              <Card style={{ marginBottom: spacing.sm, ...(active ? styles.activeCard : null) }}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: dotColor[w.category] ?? colors.secondary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{w.name}</Text>
                    <Text style={styles.sub}>{w.category} · {w.level} · ~{w.walkMins} min walk</Text>
                  </View>
                  <Text style={[styles.go, active && styles.goActive]}>{active ? '● ROUTE' : 'GO ›'}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          </Enter>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  map: { backgroundColor: colors.header, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md },
  mapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapTitle: { color: colors.textOnDark, fontWeight: '800', fontSize: 15, flex: 1 },
  mapSub: { ...typography.caption, color: colors.tabInactive, marginTop: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  youWrap: { alignItems: 'center' },
  youDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: palette.dustyBlue },
  youLabel: { color: colors.tabInactive, fontSize: 10, fontWeight: '800', marginTop: 4 },
  track: { flex: 1, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 10, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 4, backgroundColor: colors.highlight },
  destDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.highlight, borderWidth: 3, borderColor: '#fff' },
  destLabel: { color: colors.highlight, fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  walkBadge: { alignSelf: 'flex-start', backgroundColor: colors.highlight, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  walkText: { color: colors.primary, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 99, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  go: { fontWeight: '800', color: colors.accent },
  goActive: { color: colors.primary, fontSize: 11 },
  activeCard: { borderColor: colors.primary, borderWidth: 2 },
});
