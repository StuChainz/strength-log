import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ALL_PRESETS } from '@/programs/presets';
import {
  importPreset,
  PresetExerciseResolutionError,
} from '@/programs/importPreset';
import { getProgramPresetWeeklySetCount } from '@/programs/volume';
import type {
  ProgramExercise,
  ProgramPreset,
  ProgressionRuleConfig,
} from '@/programs/types';
import { openDb } from '@/db/client';
import { getNormalTemplatesWithCount } from '@/db/repositories/templates.repo';
import { T } from '@/theme/tokens';
import type {
  ProgramPreviewNavigationProp,
  ProgramPreviewRouteProp,
} from '@/navigation/types';

function repsLabel(exercise: ProgramExercise): string {
  const cfg = exercise.progression;
  if (cfg.rule === 'double' && cfg.repRangeMin != null && cfg.repRangeMax != null) {
    return `${exercise.targetSets}×${cfg.repRangeMin}-${cfg.repRangeMax}`;
  }
  if (exercise.targetReps != null) {
    const base = `${exercise.targetSets}×${exercise.targetReps}`;
    return exercise.amrapLastSet ? `${base} (last AMRAP)` : base;
  }
  return `${exercise.targetSets} sets`;
}

function progressionSummary(cfg: ProgressionRuleConfig): string {
  switch (cfg.rule) {
    case 'none':
      return 'Fixed weight';
    case 'linear': {
      const inc = cfg.incrementKg != null ? `+${cfg.incrementKg}kg` : `+${cfg.incrementLb}lb`;
      return `Linear · ${inc}/session`;
    }
    case 'double':
      return `Double progression · ${cfg.repRangeMin}-${cfg.repRangeMax} reps`;
    case 'rpe_gated':
      return `RPE-gated · cap @${cfg.rpeCap}`;
  }
}

export default function ProgramPreview() {
  const navigation = useNavigation<ProgramPreviewNavigationProp>();
  const route = useRoute<ProgramPreviewRouteProp>();
  const presetId = route.params.presetId;

  const preset = useMemo<ProgramPreset | undefined>(
    () => ALL_PRESETS.find((p) => p.id === presetId),
    [presetId],
  );

  const [importing, setImporting] = useState(false);

  if (!preset) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            testID="program-preview-back"
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Preset not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalExercises = preset.workouts.reduce((n, w) => n + w.exercises.length, 0);
  const weeklySetCount = getProgramPresetWeeklySetCount(preset);

  const runImport = async () => {
    setImporting(true);
    try {
      const db = await openDb();
      const result = await importPreset(db, preset);
      Alert.alert(
        'Imported',
        `Created ${result.templates.length} template${result.templates.length === 1 ? '' : 's'} from "${preset.name}".`,
        [{ text: 'OK', onPress: () => navigation.navigate('Main') }],
      );
    } catch (err) {
      if (err instanceof PresetExerciseResolutionError) {
        Alert.alert(
          'Import failed',
          `Some exercises in this preset are missing from your library:\n\n${err.unresolved
            .map((u) => `• ${u.normalizedName}`)
            .join('\n')}`,
        );
      } else {
        Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (importing) return;
    try {
      const db = await openDb();
      const existing = await getNormalTemplatesWithCount(db);
      const existingNames = new Set(existing.map((t) => t.name.trim().toLowerCase()));
      const collisions = preset.workouts
        .map((w) => w.name)
        .filter((n) => existingNames.has(n.trim().toLowerCase()));

      if (collisions.length > 0) {
        Alert.alert(
          'Already imported?',
          `You already have ${collisions.length === 1 ? 'a template' : 'templates'} named:\n\n${collisions
            .map((n) => `• ${n}`)
            .join(
              '\n',
            )}\n\nImporting again will create a second copy with the same name. You can rename or delete copies later.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import anyway', style: 'destructive', onPress: () => void runImport() },
          ],
        );
      } else {
        await runImport();
      }
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            testID="program-preview-back"
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>{preset.experienceLevel.toUpperCase()}</Text>
          <Text style={styles.title}>{preset.name}</Text>
          <Text style={styles.stats}>
            {preset.daysPerWeek} days/wk · {preset.workouts.length} workouts · {weeklySetCount}{' '}
            sets/wk · {totalExercises} exercises
          </Text>
          <Text style={styles.description}>{preset.description}</Text>
          {preset.source?.label ? (
            <Text style={styles.source}>Source: {preset.source.label}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          {preset.workouts.map((workout) => (
            <View key={workout.key} style={styles.workoutCard} testID={`workout-card-${workout.key}`}>
              <Text style={styles.workoutName}>{workout.name}</Text>
              {workout.notes ? <Text style={styles.workoutNotes}>{workout.notes}</Text> : null}
              <View style={styles.exerciseList}>
                {workout.exercises.map((exercise, idx) => (
                  <View key={`${workout.key}-${idx}`} style={styles.exerciseRow}>
                    <View style={styles.exerciseMain}>
                      <Text style={styles.exerciseName}>
                        {exercise.match.normalizedName}
                      </Text>
                      <Text style={styles.exerciseScheme}>
                        {repsLabel(exercise)}
                        {exercise.restSeconds != null ? ` · ${exercise.restSeconds}s rest` : ''}
                      </Text>
                      <Text style={styles.exerciseProg}>
                        {progressionSummary(exercise.progression)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.importBtn, importing && styles.importBtnDisabled]}
          onPress={() => void handleImport()}
          disabled={importing}
          testID="program-preview-import"
        >
          <Text style={styles.importBtnText}>
            {importing ? 'Importing…' : 'Use this program'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 120 },

  header: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 4 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginLeft: -6,
    marginBottom: 8,
  },
  backText: { color: T.text, fontSize: 15, fontWeight: '500' },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: T.text,
    marginTop: 4,
  },
  stats: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    letterSpacing: 0.8,
    color: T.accent,
    marginTop: 6,
  },
  description: { color: T.textDim, fontSize: 13.5, marginTop: 12, lineHeight: 20 },
  source: {
    color: T.mutedDeep,
    fontSize: 11.5,
    marginTop: 10,
    fontFamily: 'Courier New',
    letterSpacing: 0.4,
  },

  section: { paddingHorizontal: 22, paddingTop: 18, gap: 12 },
  workoutCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 14,
  },
  workoutName: { color: T.text, fontSize: 15, fontWeight: '600' },
  workoutNotes: {
    color: T.muted,
    fontSize: 12.5,
    marginTop: 4,
    fontFamily: 'Courier New',
  },
  exerciseList: { marginTop: 10, gap: 8 },
  exerciseRow: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
  },
  exerciseMain: { gap: 2 },
  exerciseName: {
    color: T.text,
    fontSize: 13.5,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  exerciseScheme: {
    color: T.textDim,
    fontSize: 12,
    fontFamily: 'Courier New',
  },
  exerciseProg: {
    color: T.muted,
    fontSize: 11.5,
    fontFamily: 'Courier New',
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(10,10,10,0.96)',
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  importBtn: {
    backgroundColor: T.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importBtnDisabled: { opacity: 0.6 },
  importBtnText: { color: T.accentInk, fontSize: 15, fontWeight: '700' },
});
