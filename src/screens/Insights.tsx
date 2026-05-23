import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { openDb } from '@/db/client';
import { getAllInsightCards, maybeGenerateWeeklyInsight } from '@/db/repositories/insights.repo';
import { InsightCard } from '@/components/InsightCard';
import { T } from '@/theme/tokens';
import type { WeeklyInsightCard } from '@/domain/types';

export default function Insights() {
  const [cards, setCards] = useState<WeeklyInsightCard[]>([]);

  const load = useCallback(async () => {
    const db = await openDb();
    await maybeGenerateWeeklyInsight(db);
    setCards(await getAllInsightCards(db));
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Weekly</Text>
        <Text style={styles.title}>Insights</Text>
        {cards.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Add tags after workouts to unlock weekly patterns.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {cards.map((card) => <InsightCard key={card.id} card={card} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 22, paddingTop: 16, paddingBottom: 24 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: T.text,
    marginTop: 4,
  },
  list: { gap: 10, marginTop: 18 },
  empty: {
    marginTop: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 14,
    padding: 16,
  },
  emptyText: { fontSize: 14, color: T.textDim, lineHeight: 20 },
});
