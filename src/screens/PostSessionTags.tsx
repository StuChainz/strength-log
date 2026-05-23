import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getWorkoutSummary, type WorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import {
  getSavedTags,
  savePostSessionDetails,
  SESSION_TAGS,
  type SessionTag,
} from '@/db/repositories/tags.repo';
import { TagChip } from '@/components/TagChip';
import { T } from '@/theme/tokens';
import type { PostSessionTagsNavigationProp, PostSessionTagsRouteProp } from '@/navigation/types';

const TAG_LABELS: Record<SessionTag, string> = {
  sleep_short: 'Sleep short',
  sleep_long: 'Sleep long',
  stressed: 'Stressed',
  sore: 'Sore',
  fasted: 'Fasted',
  caffeinated: 'Caffeinated',
  ill: 'Ill',
  traveled: 'Traveled',
  alcohol_prev_night: 'Alcohol',
  evening_session: 'Evening',
  morning_session: 'Morning',
  felt_strong: 'Felt strong',
  felt_weak: 'Felt weak',
};

function autoTags(summary: WorkoutSummary): SessionTag[] {
  const tags: SessionTag[] = [];
  const started = new Date(summary.session.started_at);
  const ended = new Date(summary.session.ended_at ?? summary.session.started_at);
  if (started.getHours() < 9) tags.push('morning_session');
  if (ended.getHours() >= 20) tags.push('evening_session');
  return tags;
}

export default function PostSessionTags() {
  const navigation = useNavigation<PostSessionTagsNavigationProp>();
  const route = useRoute<PostSessionTagsRouteProp>();
  const { sessionId } = route.params;
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [selected, setSelected] = useState<SessionTag[]>([]);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [sampledAtFallback] = useState<number>(Date.now);

  useEffect(() => {
    let cancelled = false;
    openDb()
      .then(async (db) => {
        const [nextSummary, savedTags] = await Promise.all([
          getWorkoutSummary(db, sessionId),
          getSavedTags(db, sessionId),
        ]);
        return { nextSummary, savedTags };
      })
      .then(({ nextSummary, savedTags }) => {
        if (cancelled || !nextSummary) return;
        setSummary(nextSummary);
        setSelected(savedTags.length > 0 ? savedTags : autoTags(nextSummary));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const noteCount = note.length;
  const metrics = useMemo(() => {
    if (!summary) return null;
    return {
      volume: summary.volume,
      durationMin: summary.durationMin,
      setCount: summary.setCount,
      sampledAt: summary.session.ended_at ?? sampledAtFallback,
    };
  }, [sampledAtFallback, summary]);

  const toggleTag = (tag: SessionTag) => {
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const save = async () => {
    if (!metrics) return;
    setSaving(true);
    try {
      const db = await openDb();
      await savePostSessionDetails(db, {
        sessionId,
        tags: selected,
        energyRating: energy,
        note: note.trim() || null,
        metrics,
      });
      navigation.popToTop();
    } finally {
      setSaving(false);
    }
  };

  if (!summary) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={T.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Post session</Text>
          <Text style={styles.title}>How did it go?</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.tagsWrap}>
            {SESSION_TAGS.map((tag) => (
              <TagChip
                key={tag}
                label={TAG_LABELS[tag]}
                selected={selected.includes(tag)}
                onPress={() => toggleTag(tag)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Energy</Text>
          <View style={styles.energyRow}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.energyChip, energy === value && styles.energyChipActive]}
                onPress={() => setEnergy(energy === value ? null : value)}
              >
                <Text style={[styles.energyText, energy === value && styles.energyTextActive]}>
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.noteHeader}>
            <Text style={styles.sectionLabel}>Note</Text>
            <Text style={styles.count}>{noteCount}/280</Text>
          </View>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={(text) => setNote(text.slice(0, 280))}
            placeholder="Optional"
            placeholderTextColor={T.muted}
            multiline
            maxLength={280}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={() => void save()} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          <Ionicons name="checkmark" size={18} color={T.accentInk} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },
  header: { marginBottom: 8 },
  eyebrow: {
    fontFamily: 'Courier New',
    color: T.muted,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: T.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
  section: { marginTop: 22 },
  sectionLabel: {
    fontFamily: 'Courier New',
    color: T.muted,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  energyRow: { flexDirection: 'row', gap: 5 },
  energyChip: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyChipActive: { backgroundColor: T.accent, borderColor: T.accent },
  energyText: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12 },
  energyTextActive: { color: T.accentInk, fontWeight: '700' },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  count: { color: T.muted, fontFamily: 'Courier New', fontSize: 11 },
  noteInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    color: T.text,
    padding: 12,
    textAlignVertical: 'top',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    padding: 16,
    backgroundColor: T.bg,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  saveText: { color: T.accentInk, fontSize: 16, fontWeight: '800' },
});
