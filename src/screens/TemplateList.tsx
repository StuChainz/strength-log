import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getAllTemplatesWithCount, type TemplateSummary } from '@/db/repositories/templates.repo';
import { T } from '@/theme/tokens';
import type { TemplateListNavigationProp } from '@/navigation/types';

export default function TemplateList() {
  const navigation = useNavigation<TemplateListNavigationProp>();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now);

  const loadTemplates = useCallback(async () => {
    try {
      const db = await openDb();
      const data = await getAllTemplatesWithCount(db);
      setTemplates(data);
      setNow(Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates();
    }, [loadTemplates]),
  );

  const formatLastUsed = (ts: number): string => {
    const diff = now - ts;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'YESTERDAY';
    if (days === 1) return 'YESTERDAY';
    if (days < 7) return `${days}D AGO`;
    const weeks = Math.floor(days / 7);
    return `${weeks}W AGO`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Programmes</Text>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Templates</Text>
            <TouchableOpacity
              style={styles.newBtn}
              onPress={() => navigation.navigate('TemplateBuilder', {})}
              testID="add-template-btn"
            >
              <Ionicons name="add" size={15} color={T.text} />
              <Text style={styles.newBtnText}>New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Empty workout card */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.emptyCard}
            onPress={() => navigation.navigate('LiveWorkout', {})}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.emptyCardTitle}>Empty workout</Text>
              <Text style={styles.emptyCardSub}>Pick exercises as you go</Text>
            </View>
            <TouchableOpacity
              style={styles.startChip}
              onPress={() => navigation.navigate('LiveWorkout', {})}
            >
              <Text style={styles.startChipText}>Start →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Templates list */}
        <View style={styles.section}>
          {!loading && templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No templates yet</Text>
              <Text style={styles.emptyHint}>{'Tap "New" to create your first template.'}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>SAVED · {templates.length}</Text>
              <View style={styles.templateList}>
                {templates.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.templateRow}
                    onPress={() => navigation.navigate('TemplateBuilder', { templateId: t.id })}
                    testID={`template-row-${t.id}`}
                    activeOpacity={0.7}
                  >
                    <View style={styles.templateCount}>
                      <Text style={styles.templateCountText}>{t.item_count}</Text>
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{t.name}</Text>
                      <Text style={styles.templateMeta}>
                        {t.item_count === 0
                          ? 'No exercises'
                          : `${t.item_count} exercise${t.item_count !== 1 ? 's' : ''}`}
                      </Text>
                      <Text style={styles.templateDate}>{formatLastUsed(t.updated_at)} · —</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => navigation.navigate('LiveWorkout', { templateId: t.id })}
                      testID={`start-template-${t.id}`}
                    >
                      <Ionicons name="play" size={18} color={T.accentInk} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 24 },

  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: T.text },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newBtnText: { fontSize: 13, fontWeight: '500', color: T.text },

  section: { paddingHorizontal: 22, paddingTop: 16 },
  sectionLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
    marginBottom: 10,
  },

  emptyCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.borderBright,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyCardTitle: { fontSize: 14, fontWeight: '600', color: T.text },
  emptyCardSub: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    color: T.muted,
    marginTop: 2,
  },
  startChip: {
    backgroundColor: T.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  startChipText: { fontSize: 13, fontWeight: '600', color: T.bg },

  templateList: { gap: 10 },
  templateRow: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  templateCount: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  templateCountText: {
    fontFamily: 'Courier New',
    fontSize: 14,
    fontWeight: '500',
    color: T.accent,
  },
  templateInfo: { flex: 1, minWidth: 0 },
  templateName: { fontSize: 15, fontWeight: '600', color: T.text },
  templateMeta: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    color: T.muted,
    marginTop: 2,
  },
  templateDate: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.mutedDeep,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { color: T.text, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: T.muted, fontSize: 14, textAlign: 'center' },
});
