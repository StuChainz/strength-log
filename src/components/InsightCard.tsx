import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/theme/tokens';
import type { WeeklyInsightCard } from '@/domain/types';

interface InsightCardProps {
  card: WeeklyInsightCard;
}

export function InsightCard({ card }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="sparkles-outline" size={17} color={T.accentInk} />
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.meta}>
            {card.sample_size} workouts · {card.confidence_label} confidence
          </Text>
        </View>
      </View>
      <Text style={styles.body}>{card.body}</Text>
      <TouchableOpacity style={styles.whyBtn} onPress={() => setExpanded((value) => !value)}>
        <Text style={styles.whyText}>Why am I seeing this?</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={T.muted} />
      </TouchableOpacity>
      {expanded && (
        <Text style={styles.detail}>
          Based on completed local workouts with post-session tags in the trailing eight weeks.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: T.text, fontSize: 15, fontWeight: '700' },
  meta: { color: T.muted, fontFamily: 'Courier New', fontSize: 11, marginTop: 2 },
  body: { color: T.textDim, fontSize: 13, lineHeight: 19, marginTop: 12 },
  whyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  whyText: { color: T.muted, fontSize: 12, fontWeight: '700' },
  detail: { color: T.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
