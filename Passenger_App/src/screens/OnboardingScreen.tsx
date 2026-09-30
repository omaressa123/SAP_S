import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Card, PrimaryButton, SecondaryButton } from '../components/ui';
import { DriftingPlane, Enter } from '../components/anim';
import { useApp } from '../store/AppStore';

export default function OnboardingScreen() {
  const { enroll, passengerName } = useApp();
  const [name, setName] = useState('');
  const [faceDone, setFaceDone] = useState(false);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>SMART AIRPORT · PASSENGER</Text>
          {/* Slow airport-themed drift: plane glides across the hero */}
          <View style={styles.sky}>
            <DriftingPlane>
              <Text style={styles.plane}>✈</Text>
            </DriftingPlane>
            <View style={styles.runway} />
          </View>
          <Text style={styles.heroTitle}>Smart Airport</Text>
          <Text style={styles.heroSub}>Secure identity for boarding, baggage and wayfinding.</Text>
        </View>
      </Enter>

      <Enter delay={140}>
        <Card>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Alex Traveler"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <PrimaryButton label={faceDone ? 'Enroll Face (Done ✓)' : 'Enroll Face'} onPress={() => setFaceDone(true)} />
          <SecondaryButton label={`Continue as ${name.trim() || passengerName}`} onPress={() => enroll(name)} />
          <Text style={styles.hint}>Face template stays on device · token in Secure Storage.</Text>
        </Card>
      </Enter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 64 },
  hero: { backgroundColor: colors.header, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg, overflow: 'hidden' },
  heroKicker: { color: colors.highlight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  sky: { marginTop: 14, marginBottom: 4 },
  plane: { fontSize: 30 },
  runway: { height: 2, backgroundColor: 'rgba(227,195,157,0.5)', borderRadius: 2, marginTop: 6 },
  heroTitle: { ...typography.title, color: colors.textOnDark, marginTop: 10 },
  heroSub: { ...typography.body, color: colors.tabInactive, marginTop: 6 },
  label: { ...typography.captionBold, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.cardAlt },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
});
