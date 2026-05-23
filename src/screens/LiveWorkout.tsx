import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { useSessionStore } from '@/state/session.store';
import { ExercisePicker } from '@/components/ExercisePicker';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { getProgressionSuggestion } from '@/domain/progression';
import { T } from '@/theme/tokens';
import type {
  LiveWorkoutNavigationProp,
  LiveWorkoutRouteProp,
} from '@/navigation/types';
import type { WorkoutSet } from '@/domain/types';
import type { SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_WEIGHT = 20;
const DEFAULT_REPS = 5;
const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export default function LiveWorkout() {
  const navigation = useNavigation<LiveWorkoutNavigationProp>();
  const route = useRoute<LiveWorkoutRouteProp>();
  const templateId = route.params?.templateId;

  const store = useSessionStore(templateId);
  const {
    phase,
    session,
    existingSession,
    resumedStartedAt,
    exercises,
    sets,
    activeExerciseId,
    setActiveExerciseId,
    logSet,
    endWorkout,
    discardWorkout,
    resumeExisting,
    endExisting,
    discardExisting,
    discardAndStart,
    addExercise,
  } = store;

  const [weight, setWeight] = useState(DEFAULT_WEIGHT);
  const [reps, setReps] = useState(DEFAULT_REPS);
  const [rpe, setRpe] = useState<number | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [lastSets, setLastSets] = useState<WorkoutSet[]>([]);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  const [editWeight, setEditWeight] = useState(DEFAULT_WEIGHT);
  const [editReps, setEditReps] = useState(DEFAULT_REPS);
  const [editRpe, setEditRpe] = useState<number | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const loggingRef = useRef(false);
  const completedRef = useRef(false);

  const activeExerciseIndex = exercises.findIndex((e) => e.id === activeExerciseId);
  const activeExercise = activeExerciseIndex >= 0 ? exercises[activeExerciseIndex] : null;
  const activeSets = sets.filter(
    (s) => s.exercise_id === activeExerciseId && s.deleted_at === null,
  );
  const hasLoggedSets = sets.some((s) => s.deleted_at === null);
  const suggestion = useMemo(() => getProgressionSuggestion({
    category: activeExercise?.category ?? 'barbell',
    targetReps: activeExercise?.targetReps ?? null,
    lastSet: lastSets[0]
      ? {
          weight: lastSets[0].weight,
          reps: lastSets[0].reps,
          rpe: lastSets[0].rpe,
          unit: lastSets[0].unit,
        }
      : null,
    previousSet: lastSets[1]
      ? {
          weight: lastSets[1].weight,
          reps: lastSets[1].reps,
          rpe: lastSets[1].rpe,
          unit: lastSets[1].unit,
        }
      : null,
  }), [activeExercise, lastSets]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'active' || !session) return;
    const start = session.started_at;
    const tick = () => setElapsedSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, session]);

  // Seed stepper defaults when exercise changes
  useEffect(() => {
    if (!activeExercise) return;
    const lastSet = [...sets]
      .filter((s) => s.exercise_id === activeExercise.id && s.deleted_at === null)
      .sort((a, b) => b.logged_at - a.logged_at)[0];

    if (lastSet) {
      setWeight(lastSet.weight ?? DEFAULT_WEIGHT);
      setReps(lastSet.reps ?? DEFAULT_REPS);
    } else if (activeExercise.targetWeight !== null) {
      setWeight(activeExercise.targetWeight);
      setReps(activeExercise.targetReps ?? DEFAULT_REPS);
    } else {
      setWeight(DEFAULT_WEIGHT);
      setReps(DEFAULT_REPS);
    }
    setRpe(null);
  }, [activeExerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load last-session hint for active exercise
  useEffect(() => {
    if (!activeExerciseId || !session) return;
    let cancelled = false;
    openDb()
      .then((db: SQLiteDatabase) =>
        db.getAllAsync<WorkoutSet>(
          `SELECT ws.* FROM workout_sets ws
           JOIN workout_sessions sess ON sess.id = ws.session_id
           WHERE ws.exercise_id = ?
             AND ws.session_id != ?
             AND ws.deleted_at IS NULL
             AND sess.status = 'completed'
           ORDER BY ws.logged_at DESC
           LIMIT 5`,
          [activeExerciseId, session.id],
        ),
      )
      .then((rows) => { if (!cancelled) setLastSets(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeExerciseId, session]);

  // Navigate away once session ends
  useEffect(() => {
    if (phase === 'ended' && !completedRef.current) navigation.popToTop();
  }, [phase, navigation]);

  // Prompt resume/start-new
  useEffect(() => {
    if (phase !== 'prompt_resume' || !existingSession) return;
    const started = new Date(existingSession.started_at).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
    const isStale = Date.now() - existingSession.started_at > 12 * 60 * 60 * 1000;
    const buttons = isStale
      ? [
          { text: 'Resume', onPress: resumeExisting },
          { text: 'End', onPress: endExisting },
          { text: 'Discard', style: 'destructive' as const, onPress: discardExisting },
        ]
      : [
          { text: 'Resume', onPress: resumeExisting },
          { text: 'Start New', style: 'destructive' as const, onPress: discardAndStart },
        ];
    Alert.alert(
      isStale ? 'Still working out?' : 'Workout in Progress',
      isStale
        ? `You started a workout at ${started}. Resume, end, or discard it?`
        : `You started a workout at ${started}. Resume it?`,
      buttons,
      { cancelable: false },
    );
  }, [phase, existingSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const handleLogSet = useCallback(async () => {
    if (loggingRef.current || !activeExerciseId) return;
    loggingRef.current = true;
    setIsLogging(true);
    try {
      await logSet({
        exerciseId: activeExerciseId,
        weight,
        reps,
        rpe,
        unit: activeExercise?.defaultUnit ?? 'kg',
      });
      setJustLogged(true);
      setTimeout(() => setJustLogged(false), 900);
    } finally {
      loggingRef.current = false;
      setIsLogging(false);
    }
  }, [activeExerciseId, weight, reps, rpe, activeExercise, logSet]);

  const handleEndWorkout = useCallback(() => {
    Alert.alert('End Workout', 'Finish and save this workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Workout',
        onPress: () => {
          if (!session) return;
          const endedSessionId = session.id;
          completedRef.current = true;
          void endWorkout().then(() => {
            navigation.replace('EndWorkoutSummary', { sessionId: endedSessionId });
          });
        },
      },
      { text: 'Discard', style: 'destructive', onPress: () => void discardWorkout() },
    ]);
  }, [discardWorkout, endWorkout, navigation, session]);

  const openEditSet = useCallback((set: WorkoutSet) => {
    setEditingSet(set);
    setEditWeight(set.weight ?? DEFAULT_WEIGHT);
    setEditReps(set.reps ?? DEFAULT_REPS);
    setEditRpe(set.rpe);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingSet) return;
    await store.editSet(editingSet.id, {
      weight: editWeight,
      reps: editReps,
      rpe: editRpe,
      unit: editingSet.unit,
    });
    setEditingSet(null);
  }, [editReps, editRpe, editWeight, editingSet, store]);

  const handleDeleteSet = useCallback((set: WorkoutSet) => {
    Alert.alert('Delete Set', 'Remove this set from the workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void store.deleteSet(set.id) },
    ]);
  }, [store]);

  const lastHintText = (() => {
    if (lastSets.length === 0) return null;
    const parts = lastSets
      .map((s) => {
        if (s.weight !== null && s.reps !== null) return `${s.weight}×${s.reps}`;
        if (s.reps !== null) return `${s.reps} reps`;
        return null;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  })();

  // ── Loading ─────────────────────────────────────────────────
  if (phase === 'loading' || phase === 'prompt_resume') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={T.accent} />
      </SafeAreaView>
    );
  }

  const wgt = weight % 1 === 0 ? String(weight) : weight.toFixed(1);
  const logBtnLabel = justLogged ? 'Logged ✓' : `Log set · ${wgt} × ${reps}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleEndWorkout} hitSlop={8} testID="end-workout-btn">
          <Ionicons name="chevron-back" size={16} color={T.textDim} />
        </TouchableOpacity>
        <View style={styles.elapsedPill}>
          <View style={styles.liveDot} />
          <Text style={styles.elapsedText}>{formatElapsed(elapsedSecs)}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={16} color={T.textDim} />
        </TouchableOpacity>
      </View>

      {/* ── Exercise carousel ─────────────────────────────────── */}
      {resumedStartedAt !== null && (
        <View style={styles.resumeBanner}>
          <Ionicons name="refresh" size={15} color={T.accent} />
          <Text style={styles.resumeBannerText}>
            Resumed your workout from {new Date(resumedStartedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {exercises.length > 0 && (
        <View style={styles.carouselHeader}>
          <TouchableOpacity
            style={[styles.arrowBtn, activeExerciseIndex === 0 && styles.arrowBtnDisabled]}
            onPress={() => activeExerciseIndex > 0 && setActiveExerciseId(exercises[activeExerciseIndex - 1].id)}
            disabled={activeExerciseIndex === 0}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={activeExerciseIndex === 0 ? T.mutedDeep : T.textDim} />
          </TouchableOpacity>

          <View style={styles.carouselCenter}>
            <Text style={styles.carouselEyebrow}>
              Exercise {activeExerciseIndex + 1} of {exercises.length}
            </Text>
            <Text style={styles.carouselName} numberOfLines={1}>
              {activeExercise?.name ?? '—'}
            </Text>
            {(activeExercise?.targetSets || activeExercise?.targetReps) ? (
              <Text style={styles.carouselTarget}>
                Target · {activeExercise.targetSets ?? '?'} × {activeExercise.targetReps ?? '?'}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.arrowBtn, activeExerciseIndex >= exercises.length - 1 && styles.arrowBtnDisabled]}
            onPress={() => activeExerciseIndex < exercises.length - 1 && setActiveExerciseId(exercises[activeExerciseIndex + 1].id)}
            disabled={activeExerciseIndex >= exercises.length - 1}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={activeExerciseIndex >= exercises.length - 1 ? T.mutedDeep : T.textDim} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Scrollable content ───────────────────────────────── */}
      {exercises.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>Tap below to add an exercise</Text>
          <TouchableOpacity style={styles.addExBtn} onPress={() => setPickerVisible(true)} testID="add-exercise-tab">
            <Ionicons name="add" size={20} color={T.accentInk} />
            <Text style={styles.addExBtnText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeSets}
          keyExtractor={(s) => s.id}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <>
              {/* Last-time strip */}
              <TouchableOpacity
                style={styles.lastTimeCard}
                activeOpacity={0.7}
                onPress={() => setHistoryVisible(true)}
              >
                <Ionicons name="time-outline" size={16} color={T.muted} />
                <View style={styles.lastTimeBody}>
                  <Text style={styles.lastTimeLabel}>{lastHintText ? 'LAST TIME' : 'NO HISTORY'}</Text>
                  <Text style={styles.lastTimeData} numberOfLines={1}>
                    {lastHintText ?? 'First time logging this exercise'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={T.mutedDeep} />
              </TouchableOpacity>

              {/* Sets header */}
              <View style={styles.setsHeader}>
                <Text style={styles.setsLabel}>SETS · {activeSets.length}</Text>
                {hasLoggedSets && (
                  <TouchableOpacity
                    style={styles.undoBtn}
                    onPress={() => {
                      Alert.alert('Undo last set?', undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Undo', onPress: () => void store.undoLastSet() },
                      ]);
                    }}
                  >
                    <Ionicons name="arrow-undo" size={13} color={T.textDim} />
                    <Text style={styles.undoBtnText}>UNDO</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptySetRow}>
              <Text style={styles.emptySetText}>No sets yet. Suggestion below pre-fills the logger.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.setRow} testID={`set-row-${item.id}`}>
              <Text style={styles.setIndex}>#{index + 1}</Text>
              <Text style={styles.setWeight}>
                {item.weight ?? '—'}<Text style={styles.setUnit}> {item.unit}</Text>
              </Text>
              <Text style={styles.setReps}>
                {item.reps ?? '—'}<Text style={styles.setUnit}> reps</Text>
              </Text>
              <Text style={styles.setRpe}>
                {item.rpe !== null ? `RPE ${item.rpe}` : '—'}
              </Text>
              <View style={styles.setCheck}>
                <Ionicons name="checkmark" size={14} color={T.success} />
              </View>
              <View style={styles.setActions}>
                <TouchableOpacity style={styles.setActionBtn} onPress={() => openEditSet(item)} hitSlop={6}>
                  <Ionicons name="create-outline" size={14} color={T.textDim} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.setActionBtn} onPress={() => handleDeleteSet(item)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={14} color={T.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity style={styles.addExSmallBtn} onPress={() => setPickerVisible(true)} testID="add-exercise-tab">
              <Ionicons name="add" size={15} color={T.muted} />
              <Text style={styles.addExSmallText}>Add exercise</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* ── Logger (pinned bottom) ───────────────────────────── */}
      {exercises.length > 0 && activeExercise && (
        <View style={styles.loggerBlock}>
          {/* Suggestion line */}
          <TouchableOpacity
            style={styles.suggestionRow}
            disabled={suggestion.weight === null && suggestion.reps === null}
            onPress={() => {
              if (suggestion.weight !== null) setWeight(suggestion.weight);
              if (suggestion.reps !== null) setReps(suggestion.reps);
              setRpe(null);
            }}
          >
            <View style={styles.suggestionDot} />
            <Text style={styles.suggestionText} numberOfLines={1}>
              {suggestion.weight !== null || suggestion.reps !== null ? 'Suggest · ' : ''}
              <Text style={styles.suggestionValue}>
                {suggestion.weight !== null || suggestion.reps !== null
                  ? `${suggestion.weight ?? '—'} × ${suggestion.reps ?? '—'}`
                  : suggestion.label}
              </Text>
              {suggestion.weight !== null || suggestion.reps !== null ? `  ·  ${suggestion.label}` : ''}
            </Text>
          </TouchableOpacity>

          {/* Steppers */}
          <View style={styles.steppersRow}>
            <View style={styles.stepperWrap}>
              <Text style={styles.stepperLabel}>WEIGHT · KG</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnLeft]} onPress={() => setWeight((w) => Math.max(0, parseFloat((w - 2.5).toFixed(2))))} onLongPress={() => setWeight((w) => Math.max(0, parseFloat((w - 10).toFixed(2))))} delayLongPress={400}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <Text style={styles.stepperValue}>{wgt}</Text>
                  <Text style={styles.stepperUnit}>kg</Text>
                </View>
                <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnRight]} onPress={() => setWeight((w) => parseFloat((w + 2.5).toFixed(2)))} onLongPress={() => setWeight((w) => parseFloat((w + 10).toFixed(2)))} delayLongPress={400}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperWrap}>
              <Text style={styles.stepperLabel}>REPS</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnLeft]} onPress={() => setReps((r) => Math.max(1, r - 1))} onLongPress={() => setReps((r) => Math.max(1, r - 5))} delayLongPress={400}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <Text style={styles.stepperValue}>{reps}</Text>
                  <Text style={styles.stepperUnit}>rps</Text>
                </View>
                <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnRight]} onPress={() => setReps((r) => r + 1)} onLongPress={() => setReps((r) => r + 5)} delayLongPress={400}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* RPE chips */}
          <View style={styles.rpeRow}>
            <Text style={styles.rpeLabel}>RPE</Text>
            {RPE_VALUES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rpeChip, rpe === r && styles.rpeChipActive]}
                onPress={() => setRpe(rpe === r ? null : r)}
              >
                <Text style={[styles.rpeChipText, rpe === r && styles.rpeChipTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Log set + Mic */}
          <View style={styles.logRow}>
            <TouchableOpacity
              style={[styles.logBtn, (isLogging || justLogged) && styles.logBtnPressed]}
              onPress={() => void handleLogSet()}
              disabled={isLogging}
              testID="log-set-btn"
              activeOpacity={0.88}
            >
              <Text style={styles.logBtnText}>{logBtnLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.micBtn} disabled>
              <Ionicons name="mic-outline" size={22} color={T.muted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ExercisePicker
        visible={pickerVisible}
        onSelect={(ex) => {
          addExercise({ id: ex.id, name: ex.name, category: ex.category, default_unit: ex.default_unit });
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />

      <ExerciseHistorySheet
        visible={historyVisible}
        exerciseId={activeExercise?.id ?? null}
        exerciseName={activeExercise?.name ?? ''}
        category={activeExercise?.category ?? 'barbell'}
        targetReps={activeExercise?.targetReps ?? null}
        onClose={() => setHistoryVisible(false)}
        onApplySuggestion={(next) => {
          if (next.weight !== null) setWeight(next.weight);
          if (next.reps !== null) setReps(next.reps);
          setRpe(null);
        }}
      />

      <Modal
        visible={editingSet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSet(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Set</Text>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingSet(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.steppersRow}>
              <View style={styles.stepperWrap}>
                <Text style={styles.stepperLabel}>WEIGHT · {editingSet?.unit.toUpperCase() ?? 'KG'}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnLeft]} onPress={() => setEditWeight((w) => Math.max(0, parseFloat((w - 2.5).toFixed(2))))}>
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueWrap}>
                    <Text style={styles.stepperValue}>{editWeight % 1 === 0 ? editWeight : editWeight.toFixed(1)}</Text>
                    <Text style={styles.stepperUnit}>{editingSet?.unit ?? 'kg'}</Text>
                  </View>
                  <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnRight]} onPress={() => setEditWeight((w) => parseFloat((w + 2.5).toFixed(2)))}>
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperWrap}>
                <Text style={styles.stepperLabel}>REPS</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnLeft]} onPress={() => setEditReps((r) => Math.max(1, r - 1))}>
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueWrap}>
                    <Text style={styles.stepperValue}>{editReps}</Text>
                    <Text style={styles.stepperUnit}>rps</Text>
                  </View>
                  <TouchableOpacity style={[styles.stepperBtn, styles.stepperBtnRight]} onPress={() => setEditReps((r) => r + 1)}>
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.rpeRow}>
              <Text style={styles.rpeLabel}>RPE</Text>
              {RPE_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.rpeChip, editRpe === value && styles.rpeChipActive]}
                  onPress={() => setEditRpe(editRpe === value ? null : value)}
                >
                  <Text style={[styles.rpeChipText, editRpe === value && styles.rpeChipTextActive]}>{value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveEditBtn} onPress={() => void handleSaveEdit()}>
              <Text style={styles.saveEditText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  elapsedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.surface, borderRadius: 999, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: T.accent },
  elapsedText: {
    fontFamily: 'Courier New', fontSize: 13, color: T.text, letterSpacing: 0.5,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  resumeBannerText: {
    flex: 1,
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 12,
  },

  carouselHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, gap: 12,
  },
  arrowBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  arrowBtnDisabled: { opacity: 0.3 },
  carouselCenter: { flex: 1, alignItems: 'center' },
  carouselEyebrow: {
    fontFamily: 'Courier New', fontSize: 10.5, color: T.muted,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  carouselName: {
    fontSize: 19, fontWeight: '600', color: T.text, letterSpacing: -0.3,
    marginTop: 4, textAlign: 'center',
  },
  carouselTarget: {
    fontFamily: 'Courier New', fontSize: 11.5, color: T.muted, marginTop: 3, letterSpacing: 0.4,
  },

  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },

  lastTimeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  lastTimeBody: { flex: 1, minWidth: 0 },
  lastTimeLabel: {
    fontFamily: 'Courier New', fontSize: 10, color: T.muted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  lastTimeData: { fontFamily: 'Courier New', fontSize: 12, color: T.text, marginTop: 2 },

  setsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  setsLabel: {
    fontFamily: 'Courier New', fontSize: 10.5, letterSpacing: 1.2,
    textTransform: 'uppercase', color: T.muted, fontWeight: '500',
  },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
  },
  undoBtnText: {
    fontFamily: 'Courier New', fontSize: 11.5, color: T.textDim, letterSpacing: 0.3,
  },

  setRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, marginBottom: 6,
  },
  setIndex: { fontFamily: 'Courier New', fontSize: 12, color: T.muted, width: 32 },
  setWeight: { flex: 0.9, fontFamily: 'Courier New', fontSize: 15, fontWeight: '500', color: T.text },
  setReps: { flex: 0.9, fontFamily: 'Courier New', fontSize: 15, fontWeight: '500', color: T.text },
  setRpe: { flex: 0.8, fontFamily: 'Courier New', fontSize: 12, color: T.textDim },
  setUnit: { fontSize: 10, color: T.muted },
  setCheck: { width: 28, alignItems: 'center' },
  setActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  setActionBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },

  emptySetRow: {
    paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: T.border,
    borderRadius: 12, alignItems: 'center',
  },
  emptySetText: { fontFamily: 'Courier New', fontSize: 12, color: T.muted },

  addExSmallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface,
    marginTop: 10,
  },
  addExSmallText: { fontSize: 12, color: T.muted, fontWeight: '500' },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  addExBtnText: { fontSize: 15, fontWeight: '600', color: T.accentInk },
  mutedText: { color: T.muted, fontSize: 14 },

  loggerBlock: {
    borderTopWidth: 1, borderTopColor: T.border,
    backgroundColor: T.bg, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10,
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  suggestionDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: T.accent, flexShrink: 0 },
  suggestionText: {
    fontFamily: 'Courier New', fontSize: 11.5, color: T.textDim, letterSpacing: 0.2, flex: 1,
  },
  suggestionValue: { color: T.text },

  steppersRow: { flexDirection: 'row', gap: 8 },
  stepperWrap: { flex: 1, gap: 6 },
  stepperLabel: {
    fontFamily: 'Courier New', fontSize: 10.5, letterSpacing: 1.2,
    textTransform: 'uppercase', color: T.muted, fontWeight: '500',
  },
  stepper: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: T.surface, borderRadius: 14, borderWidth: 1, borderColor: T.border, overflow: 'hidden',
  },
  stepperBtn: {
    width: 44, flexShrink: 0, backgroundColor: T.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnLeft: { borderRightWidth: 1, borderRightColor: T.border },
  stepperBtnRight: { borderLeftWidth: 1, borderLeftColor: T.border },
  stepperBtnText: { color: T.text, fontSize: 22, lineHeight: 26 },
  stepperValueWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'center', paddingVertical: 12, gap: 4,
  },
  stepperValue: {
    fontFamily: 'Courier New', fontSize: 28, fontWeight: '500',
    color: T.text, lineHeight: 32,
  },
  stepperUnit: { fontFamily: 'Courier New', fontSize: 11, color: T.muted, letterSpacing: 0.3 },

  rpeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rpeLabel: {
    fontFamily: 'Courier New', fontSize: 10.5, color: T.muted, letterSpacing: 0.5, marginRight: 4,
    flexShrink: 0,
  },
  rpeChip: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
  },
  rpeChipActive: { backgroundColor: T.text, borderColor: T.text },
  rpeChipText: { fontFamily: 'Courier New', fontSize: 11, fontWeight: '500', color: T.textDim },
  rpeChipTextActive: { color: T.bg },

  logRow: { flexDirection: 'row', gap: 8 },
  logBtn: {
    flex: 1, backgroundColor: T.accent, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: T.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 6,
  },
  logBtnPressed: { shadowOpacity: 0.15, shadowRadius: 4 },
  logBtnText: { fontSize: 16, fontWeight: '700', color: T.accentInk, letterSpacing: 0.1 },
  micBtn: {
    width: 56, height: 56, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 28, gap: 14,
  },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  editTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  saveEditBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  saveEditText: { color: T.accentInk, fontSize: 15, fontWeight: '700' },
});
