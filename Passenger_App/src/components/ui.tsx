import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { AnimatedProgress } from './anim';

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ? <Text style={styles.sectionRight}>{right}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatusPill({ label, tone = 'info' }: { label: string; tone?: 'ok' | 'warn' | 'alert' | 'info' }) {
  const bg =
    tone === 'ok' ? '#DFF0E7' : tone === 'warn' ? '#F7E8C9' : tone === 'alert' ? '#F8D9D7' : '#DCE4EF';
  const fg =
    tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : tone === 'alert' ? colors.danger : colors.info;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return <AnimatedProgress value={value} color={colors.accent} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: '#071739',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionTitle: { ...typography.subtitle, color: colors.textPrimary },
  sectionRight: { ...typography.caption, color: colors.textSecondary },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  track: { height: 8, borderRadius: 99, backgroundColor: colors.divider, overflow: 'hidden', marginTop: 8 },
  fill: { height: 8, borderRadius: 99, backgroundColor: colors.accent },
});
