import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import {
  archiveTemplate,
  getActiveProgramPresetId,
  getNormalTemplatesWithCount,
  setActiveProgramForTemplates,
  type TemplateSummary,
} from '@/db/repositories/templates.repo';
import { ALL_PRESETS } from '@/programs/presets';
import { formatSetCount } from '@/programs/volume';
import { T } from '@/theme/tokens';
import type { TemplateListNavigationProp } from '@/navigation/types';

export type TemplateProgramSection = {
  id: string;
  title: string;
  templates: TemplateSummary[];
};

export type TemplateSections = {
  programs: TemplateProgramSection[];
  custom: TemplateSummary[];
};

function getMatchingPresetIds(templateName: string): string[] {
  return ALL_PRESETS.filter((preset) =>
    preset.workouts.some((workout) => workout.name === templateName),
  ).map((preset) => preset.id);
}

function getTemplateProgramPresetIds(template: TemplateSummary): string[] {
  if (
    template.program_preset_id &&
    ALL_PRESETS.some((preset) => preset.id === template.program_preset_id)
  ) {
    return [template.program_preset_id];
  }
  return getMatchingPresetIds(template.name);
}

function getPresetMatchCounts(templates: TemplateSummary[]): Map<string, number> {
  const templateNames = new Set(templates.map((template) => template.name));
  return new Map(
    ALL_PRESETS.map((preset) => [
      preset.id,
      preset.workouts.filter((workout) => templateNames.has(workout.name)).length,
    ]),
  );
}

export function getTemplateSections(templates: TemplateSummary[]): TemplateSections {
  const presetMatchCounts = getPresetMatchCounts(templates);
  const grouped = new Map<string, TemplateSummary[]>();
  const custom: TemplateSummary[] = [];

  for (const template of templates) {
    const matchingPresetIds = getTemplateProgramPresetIds(template);
    if (matchingPresetIds.length === 0) {
      custom.push(template);
      continue;
    }

    const presetId = [...matchingPresetIds].sort((a, b) => {
      const countDiff = (presetMatchCounts.get(b) ?? 0) - (presetMatchCounts.get(a) ?? 0);
      if (countDiff !== 0) return countDiff;
      return (
        ALL_PRESETS.findIndex((preset) => preset.id === a) -
        ALL_PRESETS.findIndex((preset) => preset.id === b)
      );
    })[0]!;

    grouped.set(presetId, [...(grouped.get(presetId) ?? []), template]);
  }

  return {
    programs: ALL_PRESETS.map((preset) => ({
      id: preset.id,
      title: preset.name,
      templates: grouped.get(preset.id) ?? [],
    })).filter((section) => section.templates.length > 0),
    custom,
  };
}

function getTotalWorkingSets(templates: TemplateSummary[]): number {
  return templates.reduce((total, template) => total + template.working_set_count, 0);
}

export default function TemplateList() {
  const navigation = useNavigation<TemplateListNavigationProp>();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeProgramPresetId, setActiveProgramPresetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<number>(Date.now);
  const templateSections = useMemo(() => getTemplateSections(templates), [templates]);

  const loadTemplates = useCallback(async () => {
    try {
      const db = await openDb();
      const [data, activeProgramId] = await Promise.all([
        getNormalTemplatesWithCount(db),
        getActiveProgramPresetId(db),
      ]);
      setTemplates(data.filter((template) => template.archived_at === null));
      setActiveProgramPresetId(activeProgramId);
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

  const handleSetActiveProgram = async (section: TemplateProgramSection) => {
    const db = await openDb();
    await setActiveProgramForTemplates(
      db,
      section.id,
      section.templates.map((template) => template.id),
    );
    setActiveProgramPresetId(section.id);
    await loadTemplates();
  };

  const handleArchiveTemplate = (template: TemplateSummary) => {
    Alert.alert(
      'Remove template?',
      'This hides the template from your list. Completed workouts stay in your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const db = await openDb();
            await archiveTemplate(db, template.id);
            setTemplates((current) => current.filter((item) => item.id !== template.id));
            await loadTemplates();
          },
        },
      ],
    );
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('Issues')}
                testID="open-injuries-btn"
              >
                <Ionicons name="medkit-outline" size={17} color={T.text} />
              </TouchableOpacity>
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
        </View>

        {/* Browse presets */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.browseCard}
            onPress={() => navigation.navigate('ProgramLibrary')}
            activeOpacity={0.8}
            testID="browse-presets-btn"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>Browse programmes</Text>
              <Text style={styles.emptyCardSub}>Import a built-in preset</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.browseCard}
            onPress={() => navigation.navigate('Issues')}
            activeOpacity={0.8}
            testID="browse-injuries-btn"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyCardTitle}>Issues</Text>
              <Text style={styles.emptyCardSub}>Track notes and check-ins</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.muted} />
          </TouchableOpacity>
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
              {templateSections.programs.length > 0 && (
                <View testID="template-program-sections">
                  <Text style={styles.sectionLabel}>PROGRAMS</Text>
                  {templateSections.programs.map((section) => (
                    <View key={section.id} style={styles.templateGroup}>
                      <View style={styles.groupHeader}>
                        <View style={styles.groupTitleWrap}>
                          <Text
                            style={styles.groupLabel}
                            testID={`template-program-section-${section.id}`}
                          >
                            {section.title}
                          </Text>
                          {activeProgramPresetId === section.id && (
                            <Text
                              style={styles.activeProgramLabel}
                              testID={`active-program-${section.id}`}
                            >
                              Active
                            </Text>
                          )}
                        </View>
                        <Text style={styles.groupMeta}>
                          {formatSetCount(getTotalWorkingSets(section.templates))}/wk
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.activeProgramBtn,
                          activeProgramPresetId === section.id && styles.activeProgramBtnSelected,
                        ]}
                        activeOpacity={0.82}
                        onPress={() => void handleSetActiveProgram(section)}
                        testID={`set-active-program-${section.id}`}
                      >
                        <Ionicons
                          name={
                            activeProgramPresetId === section.id
                              ? 'checkmark-circle'
                              : 'ellipse-outline'
                          }
                          size={17}
                          color={activeProgramPresetId === section.id ? T.accent : T.textDim}
                        />
                        <Text
                          style={[
                            styles.activeProgramBtnText,
                            activeProgramPresetId === section.id &&
                              styles.activeProgramBtnTextSelected,
                          ]}
                        >
                          {activeProgramPresetId === section.id
                            ? 'Active programme'
                            : 'Make active'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.templateList}>
                        {section.templates.map((template) => (
                          <TemplateRow
                            key={template.id}
                            template={template}
                            formatLastUsed={formatLastUsed}
                            onEdit={() =>
                              navigation.navigate('TemplateBuilder', { templateId: template.id })
                            }
                            onStart={() =>
                              navigation.navigate('LiveWorkout', { templateId: template.id })
                            }
                            onArchive={() => handleArchiveTemplate(template)}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {templateSections.custom.length > 0 && (
                <View style={templateSections.programs.length > 0 && styles.customGroup}>
                  <Text style={styles.sectionLabel}>
                    CUSTOM TEMPLATES · {templateSections.custom.length}
                  </Text>
                  <View style={styles.templateList}>
                    {templateSections.custom.map((template) => (
                      <TemplateRow
                        key={template.id}
                        template={template}
                        formatLastUsed={formatLastUsed}
                        onEdit={() =>
                          navigation.navigate('TemplateBuilder', { templateId: template.id })
                        }
                        onStart={() =>
                          navigation.navigate('LiveWorkout', { templateId: template.id })
                        }
                        onArchive={() => handleArchiveTemplate(template)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TemplateRow({
  template,
  formatLastUsed,
  onEdit,
  onStart,
  onArchive,
}: {
  template: TemplateSummary;
  formatLastUsed: (ts: number) => string;
  onEdit: () => void;
  onStart: () => void;
  onArchive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.templateRow, menuOpen && styles.templateRowMenuOpen]}
      onPress={onEdit}
      testID={`template-row-${template.id}`}
      activeOpacity={0.7}
    >
      <View style={styles.templateCount}>
        <Text style={styles.templateCountText}>{template.item_count}</Text>
      </View>
      <View style={styles.templateInfo}>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateMeta}>
          {template.item_count === 0
            ? 'No exercises'
            : `${template.item_count} exercise${template.item_count !== 1 ? 's' : ''} · ${formatSetCount(template.working_set_count)}`}
        </Text>
        <Text style={styles.templateDate}>{formatLastUsed(template.updated_at)} · —</Text>
      </View>
      <TouchableOpacity
        style={styles.playBtn}
        onPress={onStart}
        testID={`start-template-${template.id}`}
      >
        <Ionicons name="play" size={18} color={T.accentInk} />
      </TouchableOpacity>
      <View style={styles.templateMenuWrap}>
        <TouchableOpacity
          style={styles.rowIconBtn}
          onPress={() => setMenuOpen((open) => !open)}
          accessibilityLabel={`Template actions for ${template.name}`}
          testID={`template-actions-${template.id}`}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={T.textDim} />
        </TouchableOpacity>
        {menuOpen && (
          <View style={styles.templateMenu} testID={`template-actions-menu-${template.id}`}>
            <TouchableOpacity
              style={styles.templateMenuItem}
              onPress={() => {
                setMenuOpen(false);
                onArchive();
              }}
              testID={`archive-template-${template.id}`}
            >
              <Ionicons name="archive-outline" size={16} color={T.danger} />
              <Text style={styles.templateMenuItemText}>Remove from list</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: T.text },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
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

  browseCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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

  templateGroup: { marginBottom: 16 },
  customGroup: { marginTop: 4 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  groupTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  groupLabel: {
    color: T.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activeProgramLabel: {
    color: T.accent,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  groupMeta: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
  },
  activeProgramBtn: {
    minHeight: 38,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  activeProgramBtnSelected: { borderColor: T.accent, backgroundColor: T.surface2 },
  activeProgramBtnText: { color: T.textDim, fontSize: 12.5, fontWeight: '700' },
  activeProgramBtnTextSelected: { color: T.text },
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
  templateRowMenuOpen: { zIndex: 30, elevation: 30 },
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
  templateMenuWrap: { position: 'relative', flexShrink: 0 },
  rowIconBtn: {
    width: 36,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateMenu: {
    position: 'absolute',
    right: 0,
    top: 48,
    zIndex: 20,
    elevation: 20,
    minWidth: 176,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingVertical: 6,
  },
  templateMenuItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  templateMenuItemText: { color: T.text, fontSize: 13, fontWeight: '700' },

  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { color: T.text, fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptyHint: { color: T.muted, fontSize: 14, textAlign: 'center' },
});
