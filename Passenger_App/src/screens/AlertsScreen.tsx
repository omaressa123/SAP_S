import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { Card, SectionTitle } from '../components/ui';
import { Enter, Pulse } from '../components/anim';
import { useApp } from '../store/AppStore';

const icon: Record<string, string> = { flight: '✈', baggage: '🧳', safety: '🛡' };

export default function AlertsScreen() {
  const { alerts, markAllRead } = useApp();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Enter delay={0}>
        <SectionTitle title="Alerts & Notifications" right="Flight / Baggage / Safety" />
      </Enter>
      {alerts.map((a, i) => {
        const body = (
          <Card key={a.id} style={{ marginBottom: spacing.sm, opacity: a.unread ? 1 : 0.75 }}>
            <View style={styles.row}>
              <Text style={styles.emoji}>{icon[a.kind]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.body}>{a.body}</Text>
              </View>
              <Text style={styles.time}>{a.time}</Text>
            </View>
            {a.unread ? <View style={styles.unread} /> : null}
          </Card>
        );
        // Slide-down + fade entrance, staggered; urgent unread cards get a gentle pulse.
        return (
          <Enter key={a.id} delay={90 + i * 100} fromY={-16}>
            {a.unread && i === 0 ? <Pulse min={1} max={1.02}>{body}</Pulse> : body}
          </Enter>
        );
      })}
      <Enter delay={90 + alerts.length * 100}>
        <Text style={styles.link} onPress={markAllRead}>Mark all as read</Text>
      </Enter>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBackground },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  emoji: { fontSize: 20, marginRight: 10 },
  title: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  body: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  time: { fontSize: 11, color: colors.textMuted, marginLeft: 8 },
  unread: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.accent, marginTop: 8 },
  link: { color: colors.secondary, fontWeight: '700', textAlign: 'center', marginTop: 12 },
});
