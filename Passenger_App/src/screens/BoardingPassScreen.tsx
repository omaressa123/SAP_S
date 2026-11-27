import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Card, SectionTitle } from '../components/ui';
import { Enter, LiveDot, Pulse, RevealOnce } from '../components/anim';
import { useApp } from '../store/AppStore';

function BoardingQR({ payload }: { payload: string }) {
  const rows = 21;
  const cells: boolean[] = [];
  let seed = (payload || 'BP').split('').reduce((a, c) => a + c.charCodeAt(0), 7);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < rows * rows; i++) {
    const r = Math.floor(i / rows);
    const c = i % rows;
    const finder = (r < 7 && c < 7) || (r < 7 && c >= rows - 7) || (r >= rows - 7 && c < 7);
    cells.push(finder ? (r % 3 !== 1 || c % 3 !== 1 ? true : r % 2 === 0) : rand() > 0.52);
  }
  return (
    <View style={qrStyles.grid}>
      {cells.map((on, i) => (
        <View key={i} style={[qrStyles.cell, { backgroundColor: on ? colors.header : '#fff' }]} />
      ))}
    </View>
  );
}

const qrStyles = StyleSheet.create({
  grid: { width: 210, height: 210, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', padding: 10, borderRadius: 12, alignSelf: 'center' },
  cell: { width: (210 - 20) / 21, height: (210 - 20) / 21 },
});

export default function BoardingPassScreen() {
  const { journey, flight, passengerName } = useApp();
  const bp = journey?.boarding_pass;
  const gate = bp?.gate || flight.gate || 'TBD';
  const boardingSoon = flight.status.toUpperCase() === 'BOARDING';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle title="Boarding Pass" right={bp?.boarding_pass_code || 'QR / Gate'} />
      </Enter>
      <Enter delay={100} fromY={26}>
        <View style={styles.pass}>
          <View style={styles.passHead}>
            <Text style={styles.passAirline}>{flight.airline} · {bp?.flight_number || flight.flightNo}</Text>
            {boardingSoon ? (
              <Pulse>
                <View style={styles.gateBadge}>
                  <Text style={styles.passGate}>GATE {gate}</Text>
                </View>
              </Pulse>
            ) : (
              <Text style={styles.passGate}>GATE {gate}</Text>
            )}
          </View>
          <View style={styles.passStripe} />
          <View style={styles.passBody}>
            <RevealOnce delay={250}>
              <BoardingQR payload={bp?.qr_payload || flight.qrPayload} />
            </RevealOnce>
            <Text style={styles.payload}>{bp?.boarding_pass_code || flight.qrPayload}</Text>
            <Enter delay={350}>
              <View style={styles.grid}>
                {[
                  ['PASSENGER', bp?.passenger_name || passengerName],
                  ['FROM', `${flight.from} · ${flight.departure}`],
                  ['TO', flight.to],
                  ['SEAT', bp?.seat || flight.seat],
                  ['BOARDING', bp?.boarding_time || '—'],
                  ['GATE', gate],
                ].map(([k, v]) => (
                  <View key={k} style={styles.cell}>
                    <Text style={styles.k}>{k}</Text>
                    <Text style={styles.v}>{v}</Text>
                  </View>
                ))}
              </View>
            </Enter>
          </View>
        </View>
      </Enter>
      <Enter delay={420}>
        <Card>
          <View style={styles.noteRow}>
            <LiveDot color={boardingSoon ? colors.warning : colors.success} />
            <Text style={styles.note}>
              {boardingSoon
                ? ` Boarding now at Gate ${gate} — have this boarding pass ready.`
                : ` Present this boarding pass at Security Gate and Boarding Gate ${gate}.`}
            </Text>
          </View>
        </Card>
      </Enter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  pass: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider },
  passHead: { backgroundColor: colors.passHeader, padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passAirline: { color: colors.textOnDark, fontWeight: '800', fontSize: 15 },
  gateBadge: { backgroundColor: 'rgba(227,195,157,0.18)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  passGate: { color: colors.highlight, fontWeight: '800', fontSize: 15 },
  passStripe: { height: 8, backgroundColor: colors.passStripe },
  passBody: { padding: spacing.lg },
  payload: { ...typography.mono, color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md },
  cell: { width: '33%', paddingVertical: 8 },
  k: { ...typography.captionBold, color: colors.textMuted },
  v: { ...typography.bodyBold, color: colors.textPrimary },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  note: { ...typography.body, color: colors.textSecondary, flex: 1, marginLeft: 8 },
});
