import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import {
  getTrainingVolumeReport,
  TRAINING_VOLUME_WINDOW_OPTIONS,
  TRAINING_VOLUME_WINDOWS,
  type TrainingVolumeReport,
  type TrainingVolumeWindow,
} from '@/db/repositories/trainingVolume.repo';
import {
  type ExerciseMuscleContribution,
  type TrainingVolumeMuscleExposure,
} from '@/domain/sessionMuscles';
import { MUSCLE_LABELS } from '@/domain/muscleLabels';
import { T } from '@/theme/tokens';
import type { TrainingVolumeNavigationProp } from '@/navigation/types';

function SourceList({ title, sources }: { title: string; sources: ExerciseMuscleContribution[] }) {
  return (
    <View style={styles.sourceBlock}>
      <Text style={styles.sourceTitle}>{title}</Text>
      {sources.length === 0 ? (
        <Text style={styles.emptySource}>None</Text>
      ) : (
        sources.map((source) => (
          <View key={source.exercise_id} style={styles.sourceRow}>
            <Text style={styles.sourceName}>{source.exercise_name}</Text>
            <Text style={styles.sourceSets}>{source.sets}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function MuscleRow({
  exposure,
  expanded,
  onPress,
}: {
  exposure: TrainingVolumeMuscleExposure;
  expanded: boolean;
  onPress: () => void;
}) {
  const label = MUSCLE_LABELS[exposure.muscle];

  return (
    <View style={styles.rowWrap} testID={`training-volume-row-${exposure.muscle}`}>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.82}
        onPress={onPress}
        testID={`training-volume-toggle-${exposure.muscle}`}
      >
        <Text style={styles.muscleName}>{label}</Text>
        <View style={styles.rowRight}>
          <Text style={styles.totalValue}>{exposure.totalExposure}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detail} testID={`training-volume-detail-${exposure.muscle}`}>
          <View style={styles.detailLine}>
            <Text style={styles.detailLabel}>Total Exposure</Text>
            <Text style={styles.detailValue}>{exposure.totalExposure}</Text>
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailLabel}>Direct Sets</Text>
            <Text style={styles.detailValue}>{exposure.directSets}</Text>
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailLabel}>Indirect Sets</Text>
            <Text style={styles.detailValue}>{exposure.indirectSets}</Text>
          </View>

          <View style={styles.divider} />
          <SourceList title="Direct Sources" sources={exposure.directSources} />
          <View style={styles.divider} />
          <SourceList title="Indirect Sources" sources={exposure.indirectSources} />
        </View>
      )}
    </View>
  );
}

export default function TrainingVolume() {
  const navigation = useNavigation<TrainingVolumeNavigationProp>();
  const [selectedWindow, setSelectedWindow] = useState<TrainingVolumeWindow>(
    TRAINING_VOLUME_WINDOWS.last7Days,
  );
  const [report, setReport] = useState<TrainingVolumeReport | null>(null);
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await openDb();
    setReport(await getTrainingVolumeReport(db, { window: selectedWindow }));
  }, [selectedWindow]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('Main', { screen: 'Home' });
          }}
          activeOpacity={0.82}
          testID="training-volume-back-btn"
        >
          <Ionicons name="arrow-back" size={17} color={T.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.eyebrow}>Rolling Window</Text>
        <Text style={styles.title}>{report?.window.title ?? selectedWindow.title}</Text>

        <View style={styles.periodTabs} testID="training-volume-period-tabs">
          {TRAINING_VOLUME_WINDOW_OPTIONS.map((window) => {
            const active = selectedWindow.id === window.id;
            return (
              <TouchableOpacity
                key={window.id}
                style={[styles.periodTab, active && styles.periodTabActive]}
                activeOpacity={0.84}
                onPress={() => {
                  if (active) return;
                  setExpandedMuscle(null);
                  setReport(null);
                  setSelectedWindow(window);
                }}
                testID={`training-volume-window-${window.id}`}
              >
                <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                  {window.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!report ? (
          <View style={styles.loading}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : report.muscles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No completed working sets in the last {report.window.days} days.
            </Text>
          </View>
        ) : (
          <View style={styles.list} testID="training-volume-list">
            {report.muscles.map((exposure) => (
              <MuscleRow
                key={exposure.muscle}
                exposure={exposure}
                expanded={expandedMuscle === exposure.muscle}
                onPress={() =>
                  setExpandedMuscle((current) =>
                    current === exposure.muscle ? null : exposure.muscle,
                  )
                }
              />
            ))}
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
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 999,
    backgroundColor: T.surface,
    marginBottom: 18,
  },
  backText: { color: T.text, fontSize: 13, fontWeight: '600' },
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
    color: T.text,
    marginTop: 4,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  periodTab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    backgroundColor: T.surface,
  },
  periodTabActive: {
    borderColor: T.accent,
    backgroundColor: T.accent,
  },
  periodTabText: {
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: '700',
  },
  periodTabTextActive: { color: T.accentInk },
  loading: { paddingVertical: 32 },
  list: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.surface,
    overflow: 'hidden',
  },
  rowWrap: {
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleName: { flex: 1, color: T.text, fontSize: 15, fontWeight: '600' },
  totalValue: {
    minWidth: 32,
    textAlign: 'right',
    color: T.text,
    fontFamily: 'Courier New',
    fontSize: 16,
  },
  detail: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  detailLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 3,
  },
  detailLabel: { color: T.textDim, fontSize: 13 },
  detailValue: { color: T.text, fontFamily: 'Courier New', fontSize: 13 },
  divider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  sourceBlock: { gap: 7 },
  sourceTitle: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sourceName: { flex: 1, color: T.text, fontSize: 13, lineHeight: 18 },
  sourceSets: {
    color: T.text,
    fontFamily: 'Courier New',
    fontSize: 13,
    minWidth: 28,
    textAlign: 'right',
  },
  emptySource: { color: T.textDim, fontSize: 13 },
  empty: {
    marginTop: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    padding: 16,
  },
  emptyText: { color: T.textDim, fontSize: 14, lineHeight: 20 },
});
