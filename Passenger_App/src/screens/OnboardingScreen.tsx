import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Card, PrimaryButton } from '../components/ui';
import { DriftingPlane, Enter } from '../components/anim';
import { useApp } from '../store/AppStore';

export default function OnboardingScreen() {
  const { pairWithQr, pairingBusy, pairingError } = useApp();
  const [qrInput, setQrInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handlePair = async () => {
    const trimmed = qrInput.trim();
    if (!trimmed) {
      setLocalError('Enter or scan the eKiosk QR pairing token (SA-PAIR:...).');
      return;
    }
    setLocalError(null);
    try {
      await pairWithQr(trimmed);
    } catch {
      // pairingError is set in AppStore
    }
  };

  const errMsg = localError || pairingError;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>SMART AIRPORT · PASSENGER</Text>
          <View style={styles.sky}>
            <DriftingPlane>
              <Text style={styles.plane}>✈</Text>
            </DriftingPlane>
            <View style={styles.runway} />
          </View>
          <Text style={styles.heroTitle}>Smart Airport</Text>
          <Text style={styles.heroSub}>Pair your phone with the eKiosk QR code to track your journey, boarding pass, and baggage.</Text>
        </View>
      </Enter>

      <Enter delay={140}>
        <Card>
          <Text style={styles.label}>eKiosk QR Pairing Token</Text>
          <TextInput
            style={styles.input}
            placeholder="Scan or paste SA-PAIR:..."
            placeholderTextColor={colors.textMuted}
            value={qrInput}
            onChangeText={setQrInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errMsg ? <Text style={styles.error}>{errMsg}</Text> : null}
          <PrimaryButton
            label={pairingBusy ? 'Pairing Journey…' : 'Pair with Airport eKiosk'}
            onPress={handlePair}
          />
          <Text style={styles.hint}>
            One-time pairing token · Zero PII in QR · Session stored in Secure Storage.
          </Text>
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
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.textPrimary, backgroundColor: colors.cardAlt, marginBottom: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
});
