import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { insertEvent, getLatestRestTimerEvent } from '@/db/repositories/events.repo';
import { getPreviousPRDataForExercises } from '@/db/repositories/prs.repo';
import { useSessionStore } from '@/state/session.store';
import { ExercisePicker } from '@/components/ExercisePicker';
import { MicButton } from '@/components/MicButton';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import VoiceConfirm from '@/screens/VoiceConfirm';
import { getProgressionSuggestion } from '@/domain/progression';
import { detectLivePotentialPRs, type LivePotentialPR, type PreviousPRData } from '@/domain/prs';
import {
  calculateSessionVolume,
  calculateWorkingSessionVolume,
  isWorkingSet,
} from '@/domain/volume';
import { newId, normalizeName } from '@/domain/ids';
import {
  addRestTimerSeconds,
  getRestTimerRemainingSeconds,
  isRestTimerDone,
} from '@/domain/restTimer';
import { isStaleCommand } from '@/voice/confidence';
import { parseVoiceCommand } from '@/voice/parser';
import { T } from '@/theme/tokens';
import type { LiveWorkoutNavigationProp, LiveWorkoutRouteProp } from '@/navigation/types';
import type { EventType, SetType, WorkoutSet } from '@/domain/types';
import type {
  RestTimerCancelledPayload,
  RestTimerCompletedPayload,
  RestTimerStartedPayload,
} from '@/domain/events';
import type { IntentResult, ParserContext } from '@/voice/commands';
import type { SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_WEIGHT = 20;
const DEFAULT_REPS = 5;
const RPE_VALUES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const SET_TYPE_OPTIONS: { value: SetType; label: string; rowLabel: string }[] = [
  { value: 'warmup', label: 'Warm-up', rowLabel: 'WARM-UP' },
  { value: 'working', label: 'Working', rowLabel: 'WORKING' },
  { value: 'drop', label: 'Drop', rowLabel: 'DROP' },
];
const REST_TIMER_PRESETS_SECONDS = [60, 90, 120, 180] as const;
const REST_TIMER_INCREMENT_SECONDS = 15;
const ENABLE_TYPED_VOICE_DEBUG = process.env.NODE_ENV !== 'production';

type RestTimerState = {
  durationSeconds: number;
  startedAt: number;
  exerciseId: string | null;
  exerciseName: string | null;
  status: 'running' | 'done';
};

function formatWeightInput(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function parseNonNegativeNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parsePositiveInteger(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function formatTargetLine(exercise: {
  defaultUnit: string | null;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetRpe: number | null;
}): string {
  const hasTarget =
    exercise.targetSets !== null ||
    exercise.targetReps !== null ||
    exercise.targetWeight !== null ||
    exercise.targetRpe !== null;
  if (!hasTarget) return 'No programmed target';

  const unit = exercise.defaultUnit ?? 'kg';
  const parts: string[] = [];
  if (exercise.targetSets !== null && exercise.targetReps !== null) {
    parts.push(`${exercise.targetSets} sets × ${exercise.targetReps} reps`);
  } else if (exercise.targetSets !== null) {
    parts.push(`${exercise.targetSets} sets`);
  } else if (exercise.targetReps !== null) {
    parts.push(`${exercise.targetReps} reps`);
  }

  if (exercise.targetWeight !== null) {
    const targetWeight = `${formatWeightInput(exercise.targetWeight)} ${unit}`;
    if (parts.length > 0) parts[0] = `${parts[0]} @ ${targetWeight}`;
    else parts.push(targetWeight);
  }

  if (exercise.targetRpe !== null) parts.push(`RPE ${formatWeightInput(exercise.targetRpe)}`);
  return parts.join(' · ');
}

function getSetTypeLabel(setType: SetType, uppercase = false): string {
  const option = SET_TYPE_OPTIONS.find((item) => item.value === setType);
  if (!option) return uppercase ? 'WORKING' : 'working';
  return uppercase ? option.rowLabel : option.label.toLowerCase();
}

function getCompactTargetLine(exercise: {
  defaultUnit: string | null;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetRpe: number | null;
}): string | null {
  const hasTarget =
    exercise.targetSets !== null ||
    exercise.targetReps !== null ||
    exercise.targetWeight !== null ||
    exercise.targetRpe !== null;
  if (!hasTarget) return null;

  const unit = exercise.defaultUnit ?? 'kg';
  const parts: string[] = [];
  if (exercise.targetSets !== null && exercise.targetReps !== null) {
    parts.push(`${exercise.targetSets} × ${exercise.targetReps}`);
  } else if (exercise.targetSets !== null) {
    parts.push(`${exercise.targetSets} sets`);
  } else if (exercise.targetReps !== null) {
    parts.push(`${exercise.targetReps} reps`);
  }
  if (exercise.targetWeight !== null) {
    parts.push(`@ ${formatWeightInput(exercise.targetWeight)} ${unit}`);
  }
  if (exercise.targetRpe !== null) parts.push(`RPE ${formatWeightInput(exercise.targetRpe)}`);
  return parts.join(' ');
}

function getSuggestionReason(label: string): string {
  if (label === 'No suggestion yet.') return 'No suggestion yet';
  if (label.startsWith('-10%') || label === 'Same weight, one fewer rep.') {
    return 'Back off after missed reps';
  }
  if (label.startsWith('Add ')) return 'Progress after easy set';
  if (label === 'Same weight, same reps.') return 'Repeat target';
  return label.replace(/\.$/, '');
}

function getRecentHistoryBuckets(sets: WorkoutSet[]): {
  recentSets: WorkoutSet[];
  previousSessionSets: WorkoutSet[];
} {
  const visibleSets = sets.filter((set) => set.deleted_at === null);
  const recentSessionId = visibleSets[0]?.session_id ?? null;
  const previousSessionId =
    visibleSets.find((set) => set.session_id !== recentSessionId)?.session_id ?? null;

  return {
    recentSets:
      recentSessionId === null
        ? []
        : visibleSets
            .filter((set) => set.session_id === recentSessionId)
            .sort((a, b) => a.position - b.position),
    previousSessionSets:
      previousSessionId === null
        ? []
        : visibleSets
            .filter((set) => set.session_id === previousSessionId)
            .sort((a, b) => a.position - b.position),
  };
}

function formatPotentialPRLine(indicators: Pick<LivePotentialPR, 'label'>[]): string {
  const labels = Array.from(new Set(indicators.map((indicator) => indicator.label)));
  return `${labels.join(' · ')} · PR pending until workout is saved`;
}

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
  const [weightInput, setWeightInput] = useState(formatWeightInput(DEFAULT_WEIGHT));
  const [isWeightInputFocused, setIsWeightInputFocused] = useState(false);
  const [reps, setReps] = useState(DEFAULT_REPS);
  const [repsInput, setRepsInput] = useState(String(DEFAULT_REPS));
  const [isRepsInputFocused, setIsRepsInputFocused] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [setType, setSetType] = useState<SetType>('working');
  const [isLogging, setIsLogging] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [lastSets, setLastSets] = useState<WorkoutSet[]>([]);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  const [editWeight, setEditWeight] = useState(DEFAULT_WEIGHT);
  const [editReps, setEditReps] = useState(DEFAULT_REPS);
  const [editRpe, setEditRpe] = useState<number | null>(null);
  const [editSetType, setEditSetType] = useState<SetType>('working');
  const [historyVisible, setHistoryVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [previousPRData, setPreviousPRData] = useState<PreviousPRData | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [voiceResult, setVoiceResult] = useState<IntentResult | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [setDrafts, setSetDrafts] = useState<Record<string, { weight?: string; reps?: string }>>(
    {},
  );
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [restNow, setRestNow] = useState(Date.now());
  const [exerciseRestSecondsById, setExerciseRestSecondsById] = useState<
    Record<string, number | null>
  >({});
  const loggingRef = useRef(false);
  const completedRef = useRef(false);
  const completedRestTimerKeyRef = useRef<string | null>(null);
  const justLoggedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeExerciseIndex = exercises.findIndex((e) => e.id === activeExerciseId);
  const activeExercise = activeExerciseIndex >= 0 ? exercises[activeExerciseIndex] : null;
  const activeSets = sets.filter(
    (s) => s.exercise_id === activeExerciseId && s.deleted_at === null,
  );
  const exerciseIdsKey = useMemo(
    () => [...new Set(exercises.map((exercise) => exercise.id))].sort().join('|'),
    [exercises],
  );
  const liveSummary = useMemo(() => {
    const visibleSets = sets.filter((set) => set.deleted_at === null);
    const exercisesWithDone = new Set(visibleSets.map((set) => set.exercise_id));
    const summaryExercises = exercises
      .filter((exercise) => session?.template_id || exercisesWithDone.has(exercise.id))
      .map((exercise) => {
        const completedSets = visibleSets
          .filter((set) => set.exercise_id === exercise.id)
          .sort((a, b) => a.position - b.position);
        const completedWorkingSets = completedSets.filter(isWorkingSet).length;
        const remainingSets =
          exercise.targetSets !== null
            ? Math.max(0, exercise.targetSets - completedWorkingSets)
            : null;
        let state = 'not started';
        if (completedWorkingSets > 0) {
          state = remainingSets === 0 ? 'complete' : 'in progress';
        }

        return {
          exercise,
          completedSets,
          remainingSets,
          state,
          target: getCompactTargetLine(exercise),
        };
      });

    return {
      totalSets: visibleSets.length,
      workingSets: visibleSets.filter(isWorkingSet).length,
      totalVolume: calculateSessionVolume(visibleSets),
      workingVolume: calculateWorkingSessionVolume(visibleSets),
      exercises: summaryExercises,
    };
  }, [exercises, session?.template_id, sets]);
  const hasLoggedSets = sets.some((s) => s.deleted_at === null);
  const lastLoggedSet = useMemo(
    () =>
      [...sets]
        .filter((set) => set.deleted_at === null)
        .sort((a, b) => b.logged_at - a.logged_at)[0] ?? null,
    [sets],
  );
  const parserContext: ParserContext = useMemo(
    () => ({
      activeExerciseId,
      defaultUnit: activeExercise?.defaultUnit ?? 'kg',
      exercises: exercises.map((exercise) => ({
        id: exercise.id,
        normalizedName: normalizeName(exercise.name),
        aliases: [normalizeName(exercise.name.split(' ')[0] ?? exercise.name)],
      })),
      lastSet: lastLoggedSet
        ? {
            setId: lastLoggedSet.id,
            exerciseId: lastLoggedSet.exercise_id,
            weight: lastLoggedSet.weight,
            reps: lastLoggedSet.reps,
            rpe: lastLoggedSet.rpe,
            unit: lastLoggedSet.unit,
            loggedAt: lastLoggedSet.logged_at,
          }
        : null,
    }),
    [activeExercise, activeExerciseId, exercises, lastLoggedSet],
  );
  const suggestion = useMemo(
    () => {
      const { recentSets, previousSessionSets } = getRecentHistoryBuckets(lastSets);
      return getProgressionSuggestion({
        exercise: activeExercise?.progressionExercise ?? {
          category: activeExercise?.category ?? 'barbell',
        },
        templateTarget: {
          targetSets: activeExercise?.targetSets ?? null,
          targetReps: activeExercise?.targetReps ?? null,
          targetWeight: activeExercise?.targetWeight ?? null,
          unit: activeExercise?.defaultUnit ?? 'kg',
        },
        progressionRule: activeExercise?.progressionRule ?? { rule: 'none' },
        recentSets,
        previousSessionSets,
      });
    },
    [activeExercise, lastSets],
  );
  const potentialPRs = useMemo(
    () => (previousPRData ? detectLivePotentialPRs(sets, previousPRData) : []),
    [previousPRData, sets],
  );
  const potentialPRsBySetId = useMemo(() => {
    const bySetId = new Map<string, LivePotentialPR[]>();
    for (const indicator of potentialPRs) {
      if (!indicator.set_id) continue;
      bySetId.set(indicator.set_id, [...(bySetId.get(indicator.set_id) ?? []), indicator]);
    }
    return bySetId;
  }, [potentialPRs]);
  const activeVolumePR = potentialPRs.find(
    (indicator) =>
      indicator.exercise_id === activeExerciseId && indicator.record_type === 'session_volume',
  );
  const restRemainingSeconds = restTimer
    ? getRestTimerRemainingSeconds(restTimer, restNow)
    : 0;
  const restTimerExerciseName =
    restTimer?.exerciseName ??
    exercises.find((exercise) => exercise.id === restTimer?.exerciseId)?.name ??
    activeExercise?.name ??
    null;
  const getExerciseRestSeconds = useCallback(
    (exercise: { id: string; restSeconds: number | null }): number | null => {
      if (Object.prototype.hasOwnProperty.call(exerciseRestSecondsById, exercise.id)) {
        return exerciseRestSecondsById[exercise.id] ?? null;
      }
      return exercise.restSeconds;
    },
    [exerciseRestSecondsById],
  );
  const activeRestSeconds = activeExercise ? getExerciseRestSeconds(activeExercise) : null;

  useEffect(() => {
    if (!session || exerciseIdsKey.length === 0) {
      setPreviousPRData(null);
      return;
    }

    setPreviousPRData(null);
    const exerciseIds = exerciseIdsKey.split('|');
    let cancelled = false;
    openDb()
      .then((db) => getPreviousPRDataForExercises(db, exerciseIds, session.id))
      .then((data) => {
        if (!cancelled) setPreviousPRData(data);
      })
      .catch(() => {
        if (!cancelled) setPreviousPRData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseIdsKey, session]);

  // Elapsed timer
  useEffect(() => {
    if (phase !== 'active' || !session) return;
    const start = session.started_at;
    const tick = () => setElapsedSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, session]);

  // Recover the latest rest timer event for resumed in-progress sessions.
  useEffect(() => {
    if (phase !== 'active' || !session) return;
    let cancelled = false;
    openDb()
      .then((db) => getLatestRestTimerEvent(db, session.id))
      .then((event) => {
        if (cancelled || !event || event.event_type !== 'rest_timer_started') return;
        const payload = JSON.parse(event.payload_json) as RestTimerStartedPayload;
        if (!Number.isFinite(payload.duration_seconds) || payload.duration_seconds <= 0) return;
        const exercise = exercises.find((item) => item.id === payload.exercise_id);
        const recoveredTimer: RestTimerState = {
          durationSeconds: Math.floor(payload.duration_seconds),
          startedAt: payload.started_at,
          exerciseId: payload.exercise_id,
          exerciseName: exercise?.name ?? null,
          status: isRestTimerDone(
            {
              durationSeconds: payload.duration_seconds,
              startedAt: payload.started_at,
            },
            Date.now(),
          )
            ? 'done'
            : 'running',
        };
        setRestNow(Date.now());
        setRestTimer(recoveredTimer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [exercises, phase, session]);

  // Foreground rest timer tick.
  useEffect(() => {
    if (!restTimer || restTimer.status !== 'running') return;
    const tick = () => setRestNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restTimer]);

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

  useEffect(() => {
    if (!isWeightInputFocused) setWeightInput(formatWeightInput(weight));
  }, [isWeightInputFocused, weight]);

  useEffect(() => {
    if (!isRepsInputFocused) setRepsInput(String(reps));
  }, [isRepsInputFocused, reps]);

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
           ORDER BY sess.started_at DESC, ws.position ASC
           LIMIT 12`,
          [activeExerciseId, session.id],
        ),
      )
      .then((rows) => {
        if (!cancelled) setLastSets(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeExerciseId, session]);

  // Navigate away once session ends
  useEffect(() => {
    if (phase === 'ended' && !completedRef.current) navigation.popToTop();
  }, [phase, navigation]);

  useEffect(
    () => () => {
      if (justLoggedTimeoutRef.current) clearTimeout(justLoggedTimeoutRef.current);
    },
    [],
  );

  // Prompt resume/start-new
  useEffect(() => {
    if (phase !== 'prompt_resume' || !existingSession) return;
    const started = new Date(existingSession.started_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
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

  const commitWeightInput = useCallback(() => {
    const parsed = parseNonNegativeNumber(weightInput);
    if (parsed === null) {
      setWeightInput(formatWeightInput(weight));
      return weight;
    }
    const nextWeight = parseFloat(parsed.toFixed(2));
    setWeight(nextWeight);
    setWeightInput(formatWeightInput(nextWeight));
    return nextWeight;
  }, [weight, weightInput]);

  const commitRepsInput = useCallback(() => {
    const parsed = parsePositiveInteger(repsInput);
    if (parsed === null) {
      setRepsInput(String(reps));
      return reps;
    }
    setReps(parsed);
    setRepsInput(String(parsed));
    return parsed;
  }, [reps, repsInput]);

  const appendRestTimerEvent = useCallback(
    async (
      eventType: Extract<
        EventType,
        'rest_timer_started' | 'rest_timer_cancelled' | 'rest_timer_completed'
      >,
      payload: RestTimerStartedPayload | RestTimerCancelledPayload | RestTimerCompletedPayload,
    ) => {
      if (!session) return;
      const db = await openDb();
      await insertEvent(db, {
        id: newId(),
        session_id: session.id,
        event_type: eventType,
        payload_json: JSON.stringify(payload),
        client_event_id: newId(),
      });
    },
    [session],
  );

  const startRestTimer = useCallback(
    (
      durationSeconds: number,
      exercise: { id: string; name: string } | null = activeExercise,
      startedAt = Date.now(),
    ) => {
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
      const roundedDuration = Math.floor(durationSeconds);
      const nextTimer: RestTimerState = {
        durationSeconds: roundedDuration,
        startedAt,
        exerciseId: exercise?.id ?? null,
        exerciseName: exercise?.name ?? null,
        status: 'running',
      };
      completedRestTimerKeyRef.current = null;
      setRestNow(Date.now());
      setRestTimer(nextTimer);
      void appendRestTimerEvent('rest_timer_started', {
        duration_seconds: roundedDuration,
        started_at: startedAt,
        exercise_id: exercise?.id ?? null,
      });
    },
    [activeExercise, appendRestTimerEvent],
  );

  const handleAddRestTime = useCallback(() => {
    if (!restTimer) return;
    const nextTimer: RestTimerState = {
      ...addRestTimerSeconds(restTimer, REST_TIMER_INCREMENT_SECONDS),
      exerciseId: restTimer.exerciseId,
      exerciseName: restTimer.exerciseName,
      status: 'running',
    };
    completedRestTimerKeyRef.current = null;
    setRestNow(Date.now());
    setRestTimer(nextTimer);
    void appendRestTimerEvent('rest_timer_started', {
      duration_seconds: nextTimer.durationSeconds,
      started_at: nextTimer.startedAt,
      exercise_id: nextTimer.exerciseId,
    });
  }, [appendRestTimerEvent, restTimer]);

  const handleSubtractRestTime = useCallback(() => {
    if (!restTimer) return;
    const nextTimer: RestTimerState = {
      ...addRestTimerSeconds(restTimer, -REST_TIMER_INCREMENT_SECONDS),
      exerciseId: restTimer.exerciseId,
      exerciseName: restTimer.exerciseName,
      status: 'running',
    };
    completedRestTimerKeyRef.current = null;
    setRestNow(Date.now());
    setRestTimer(nextTimer);
    void appendRestTimerEvent('rest_timer_started', {
      duration_seconds: nextTimer.durationSeconds,
      started_at: nextTimer.startedAt,
      exercise_id: nextTimer.exerciseId,
    });
  }, [appendRestTimerEvent, restTimer]);

  const handleManualRestStart = useCallback(
    (seconds: number) => {
      if (!activeExercise) return;
      setExerciseRestSecondsById((prev) => ({ ...prev, [activeExercise.id]: seconds }));
      startRestTimer(seconds, activeExercise);
    },
    [activeExercise, startRestTimer],
  );

  const handleClearExerciseRest = useCallback(() => {
    if (!activeExercise) return;
    setExerciseRestSecondsById((prev) => ({ ...prev, [activeExercise.id]: null }));
  }, [activeExercise]);

  const handleStopRestTimer = useCallback(() => {
    if (!restTimer) return;
    const wasRunning = restTimer.status === 'running';
    setRestTimer(null);
    completedRestTimerKeyRef.current = null;
    if (wasRunning) {
      void appendRestTimerEvent('rest_timer_cancelled', { cancelled_at: Date.now() });
    }
  }, [appendRestTimerEvent, restTimer]);

  useEffect(() => {
    if (!restTimer || restTimer.status !== 'running' || restRemainingSeconds > 0) return;
    const timerKey = `${restTimer.startedAt}:${restTimer.durationSeconds}:${
      restTimer.exerciseId ?? ''
    }`;
    if (completedRestTimerKeyRef.current === timerKey) return;
    completedRestTimerKeyRef.current = timerKey;
    setRestTimer((current) => (current ? { ...current, status: 'done' } : current));
    Vibration.vibrate([0, 80, 80, 80]);
    void appendRestTimerEvent('rest_timer_completed', { completed_at: Date.now() });
  }, [appendRestTimerEvent, restRemainingSeconds, restTimer]);

  const updateSetDraft = useCallback((setId: string, field: 'weight' | 'reps', value: string) => {
    setSetDrafts((prev) => ({
      ...prev,
      [setId]: {
        ...prev[setId],
        [field]: value,
      },
    }));
  }, []);

  const clearSetDraft = useCallback((setId: string, field: 'weight' | 'reps') => {
    setSetDrafts((prev) => {
      const current = prev[setId];
      if (!current || current[field] === undefined) return prev;
      const nextForSet = { ...current };
      delete nextForSet[field];
      if (nextForSet.weight === undefined && nextForSet.reps === undefined) {
        const next = { ...prev };
        delete next[setId];
        return next;
      }
      return { ...prev, [setId]: nextForSet };
    });
  }, []);

  const commitSetWeightInput = useCallback(
    async (set: WorkoutSet) => {
      const draft = setDrafts[set.id]?.weight;
      if (draft === undefined) return;

      const trimmed = draft.trim();
      const nextWeight = trimmed.length === 0 ? null : parseNonNegativeNumber(trimmed);
      if (trimmed.length > 0 && nextWeight === null) {
        clearSetDraft(set.id, 'weight');
        return;
      }

      const roundedWeight = nextWeight === null ? null : parseFloat(nextWeight.toFixed(2));
      clearSetDraft(set.id, 'weight');
      if (roundedWeight === set.weight) return;
      await store.editSet(set.id, { weight: roundedWeight, unit: set.unit });
    },
    [clearSetDraft, setDrafts, store],
  );

  const commitSetRepsInput = useCallback(
    async (set: WorkoutSet) => {
      const draft = setDrafts[set.id]?.reps;
      if (draft === undefined) return;

      const trimmed = draft.trim();
      const nextReps = trimmed.length === 0 ? null : parsePositiveInteger(trimmed);
      if (trimmed.length > 0 && nextReps === null) {
        clearSetDraft(set.id, 'reps');
        return;
      }

      clearSetDraft(set.id, 'reps');
      if (nextReps === set.reps) return;
      await store.editSet(set.id, { reps: nextReps, unit: set.unit });
    },
    [clearSetDraft, setDrafts, store],
  );

  const handleLogSet = useCallback(async () => {
    if (loggingRef.current || !activeExerciseId) return;
    const loggedWeight = commitWeightInput();
    const loggedReps = commitRepsInput();
    loggingRef.current = true;
    setIsLogging(true);
    try {
      await logSet({
        exerciseId: activeExerciseId,
        weight: loggedWeight,
        reps: loggedReps,
        rpe,
        unit: activeExercise?.defaultUnit ?? 'kg',
        setType,
      });
      const restSeconds = activeExercise ? getExerciseRestSeconds(activeExercise) : null;
      if (restSeconds) {
        startRestTimer(restSeconds, activeExercise);
      }
      if (setType === 'warmup') setSetType('working');
      Vibration.vibrate(10);
      setJustLogged(true);
      if (justLoggedTimeoutRef.current) clearTimeout(justLoggedTimeoutRef.current);
      justLoggedTimeoutRef.current = setTimeout(() => {
        setJustLogged(false);
        justLoggedTimeoutRef.current = null;
      }, 900);
    } finally {
      loggingRef.current = false;
      setIsLogging(false);
    }
  }, [
    activeExerciseId,
    activeExercise,
    commitRepsInput,
    commitWeightInput,
    getExerciseRestSeconds,
    logSet,
    rpe,
    setType,
    startRestTimer,
  ]);

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
            Vibration.vibrate(30);
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
    setEditSetType(set.set_type);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingSet) return;
    await store.editSet(editingSet.id, {
      weight: editWeight,
      reps: editReps,
      rpe: editRpe,
      unit: editingSet.unit,
      set_type: editSetType,
    });
    setEditingSet(null);
  }, [editReps, editRpe, editSetType, editWeight, editingSet, store]);

  const handleDeleteSet = useCallback(
    (set: WorkoutSet) => {
      Alert.alert('Delete Set', 'Remove this set from the workout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void store.deleteSet(set.id) },
      ]);
    },
    [store],
  );

  const commitVoiceResult = useCallback(
    async (parsed: IntentResult) => {
      if (isStaleCommand(parsed.recognisedAt)) {
        setVoiceMessage('Tap to log instead.');
        return;
      }

      if (
        parsed.intent === 'log_set' ||
        parsed.intent === 'log_set_same' ||
        parsed.intent === 'log_set_delta'
      ) {
        const exerciseId = parsed.args.exerciseId as string;
        await logSet({
          exerciseId,
          weight: parsed.args.weight as number,
          reps: parsed.args.reps as number,
          rpe: null,
          unit: parsed.args.unit as 'kg' | 'lb',
          source: 'voice',
        });
        const loggedExercise = exercises.find((exercise) => exercise.id === exerciseId);
        const restSeconds = loggedExercise ? getExerciseRestSeconds(loggedExercise) : null;
        if (loggedExercise && restSeconds) startRestTimer(restSeconds, loggedExercise);
        setVoiceMessage('Logged from typed voice.');
        return;
      }

      if (parsed.intent === 'set_rpe') {
        await store.editSet(parsed.args.setId as string, { rpe: parsed.args.rpe as number });
        setVoiceMessage('RPE updated.');
        return;
      }

      if (parsed.intent === 'undo') {
        await store.undoLastSet();
        setVoiceMessage('Undone.');
        return;
      }

      if (parsed.intent === 'next_exercise' && activeExerciseIndex < exercises.length - 1) {
        setActiveExerciseId(exercises[activeExerciseIndex + 1].id);
        return;
      }

      if (parsed.intent === 'prev_exercise' && activeExerciseIndex > 0) {
        setActiveExerciseId(exercises[activeExerciseIndex - 1].id);
        return;
      }

      if (parsed.intent === 'start_rest_timer') {
        const seconds = parsed.args.seconds as number;
        if (activeExercise) {
          setExerciseRestSecondsById((prev) => ({ ...prev, [activeExercise.id]: seconds }));
        }
        startRestTimer(seconds, activeExercise);
        setVoiceMessage('Rest timer started.');
        return;
      }

      if (parsed.intent === 'end_workout') {
        handleEndWorkout();
      }
    },
    [
      activeExercise,
      activeExerciseIndex,
      exercises,
      getExerciseRestSeconds,
      handleEndWorkout,
      logSet,
      setActiveExerciseId,
      startRestTimer,
      store,
    ],
  );

  const handleVoiceDebugSubmit = useCallback(() => {
    const parsed = parseVoiceCommand(voiceText, parserContext);
    setVoiceResult(parsed);
    if (!parsed) {
      setVoiceMessage('Tap to log instead.');
      return;
    }
    setVoiceMessage(null);
    if (parsed.intent === 'end_workout' || parsed.confidence === 'medium') return;
    void commitVoiceResult(parsed);
  }, [commitVoiceResult, parserContext, voiceText]);

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

  const wgt = formatWeightInput(weight);
  const logBtnLabel = justLogged ? 'Logged ✓' : `Log set · ${wgt} × ${reps}`;
  const activeUnit = activeExercise?.defaultUnit ?? 'kg';
  const targetLine = activeExercise ? formatTargetLine(activeExercise) : 'No programmed target';
  const targetCompletion =
    activeExercise?.targetSets !== null && activeExercise?.targetSets !== undefined
      ? `${Math.min(activeSets.filter(isWorkingSet).length, activeExercise.targetSets)} / ${
          activeExercise.targetSets
        } complete`
      : null;
  const suggestionHasValue = suggestion.weight !== null || suggestion.reps !== null;
  const suggestionReason = suggestion.reason || getSuggestionReason(suggestion.label);
  const nextSetSummary = `${wgt} ${activeUnit} × ${reps} reps${
    rpe !== null ? ` · RPE ${formatWeightInput(rpe)}` : ''
  } · ${getSetTypeLabel(setType)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Top bar ──────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topActionBtn}
          onPress={() => setSummaryVisible(true)}
          hitSlop={8}
          testID="summary-btn"
        >
          <Ionicons name="stats-chart-outline" size={14} color={T.textDim} />
          <Text style={styles.topActionText}>Summary</Text>
        </TouchableOpacity>
        <View style={styles.elapsedPill}>
          <View style={styles.liveDot} />
          <Text style={styles.elapsedText}>{formatElapsed(elapsedSecs)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.topActionBtn, styles.finishBtn]}
          onPress={handleEndWorkout}
          hitSlop={8}
          testID="end-workout-btn"
        >
          <Text style={[styles.topActionText, styles.finishBtnText]}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* ── Exercise carousel ─────────────────────────────────── */}
      {resumedStartedAt !== null && (
        <View style={styles.resumeBanner}>
          <Ionicons name="refresh" size={15} color={T.accent} />
          <Text style={styles.resumeBannerText}>
            Resumed your workout from{' '}
            {new Date(resumedStartedAt).toLocaleTimeString([], {
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
            onPress={() =>
              activeExerciseIndex > 0 && setActiveExerciseId(exercises[activeExerciseIndex - 1].id)
            }
            disabled={activeExerciseIndex === 0}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={activeExerciseIndex === 0 ? T.mutedDeep : T.textDim}
            />
          </TouchableOpacity>

          <View style={styles.carouselCenter}>
            <Text style={styles.carouselEyebrow}>
              Exercise {activeExerciseIndex + 1} of {exercises.length}
            </Text>
            <Text style={styles.carouselName} numberOfLines={1}>
              {activeExercise?.name ?? '—'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.arrowBtn,
              activeExerciseIndex >= exercises.length - 1 && styles.arrowBtnDisabled,
            ]}
            onPress={() =>
              activeExerciseIndex < exercises.length - 1 &&
              setActiveExerciseId(exercises[activeExerciseIndex + 1].id)
            }
            disabled={activeExerciseIndex >= exercises.length - 1}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={activeExerciseIndex >= exercises.length - 1 ? T.mutedDeep : T.textDim}
            />
          </TouchableOpacity>
        </View>
      )}

      {exercises.length > 0 && (
        <View style={styles.restTimerPanel} testID="rest-timer-panel">
          {restTimer ? (
            <>
              <View style={styles.restTimerMain}>
                <Text style={styles.restTimerLabel}>
                  {restTimer.status === 'done' ? 'Rest done' : 'Rest'}
                </Text>
                <Text style={styles.restTimerValue} testID="rest-timer-remaining">
                  {formatElapsed(restRemainingSeconds)}
                </Text>
                {restTimerExerciseName && (
                  <Text style={styles.restTimerExercise} numberOfLines={1}>
                    {restTimerExerciseName}
                  </Text>
                )}
              </View>
              <View style={styles.restTimerActions}>
                <TouchableOpacity
                  style={styles.restTimerActionBtn}
                  onPress={handleSubtractRestTime}
                  testID="rest-subtract-15"
                >
                  <Text style={styles.restTimerActionText}>-15s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.restTimerActionBtn}
                  onPress={handleAddRestTime}
                  testID="rest-add-15"
                >
                  <Text style={styles.restTimerActionText}>+15s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.restTimerActionBtn}
                  onPress={handleStopRestTimer}
                  testID="rest-stop"
                >
                  <Text style={styles.restTimerActionText}>
                    {restTimer.status === 'done' ? 'Clear' : 'Skip'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.manualRestLabel}>
                {activeRestSeconds ? `Rest ${formatElapsed(activeRestSeconds)}` : 'Rest'}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.manualRestOptions}
              >
                <TouchableOpacity
                  style={[styles.manualRestBtn, activeRestSeconds === null && styles.manualRestBtnActive]}
                  onPress={handleClearExerciseRest}
                  testID="manual-rest-off"
                >
                  <Text
                    style={[
                      styles.manualRestBtnText,
                      activeRestSeconds === null && styles.manualRestBtnTextActive,
                    ]}
                  >
                    Off
                  </Text>
                </TouchableOpacity>
                {REST_TIMER_PRESETS_SECONDS.map((seconds) => (
                  <TouchableOpacity
                    key={seconds}
                    style={[
                      styles.manualRestBtn,
                      activeRestSeconds === seconds && styles.manualRestBtnActive,
                    ]}
                    onPress={() => handleManualRestStart(seconds)}
                    testID={`manual-rest-${seconds}`}
                  >
                    <Text
                      style={[
                        styles.manualRestBtnText,
                        activeRestSeconds === seconds && styles.manualRestBtnTextActive,
                      ]}
                    >
                      {seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* ── Scrollable content ───────────────────────────────── */}
      {exercises.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.mutedText}>Tap below to add an exercise</Text>
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => setPickerVisible(true)}
            testID="add-exercise-tab"
          >
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
              {/* Today's target */}
              <View style={styles.targetCard} testID="todays-target-card">
                <Text style={styles.targetLabel}>{"TODAY'S TARGET"}</Text>
                <Text style={styles.targetValue}>{targetLine}</Text>
                {targetCompletion !== null && (
                  <Text style={styles.targetCompletion}>{targetCompletion}</Text>
                )}
              </View>

              {/* Last-time strip */}
              <TouchableOpacity
                style={styles.lastTimeCard}
                activeOpacity={0.7}
                onPress={() => setHistoryVisible(true)}
              >
                <Ionicons name="time-outline" size={16} color={T.muted} />
                <View style={styles.lastTimeBody}>
                  <Text style={styles.lastTimeLabel}>
                    {lastHintText ? 'LAST TIME' : 'NO HISTORY'}
                  </Text>
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
              {activeVolumePR && (
                <View style={styles.potentialPrCard} testID="active-volume-pr-pending">
                  <Ionicons name="sparkles-outline" size={13} color={T.accent} />
                  <Text style={styles.potentialPrText}>
                    {formatPotentialPRLine([activeVolumePR])}
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptySetRow}>
              <Text style={styles.emptySetText}>
                No sets yet. Suggestion below pre-fills the logger.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const rowPotentialPRs = potentialPRsBySetId.get(item.id) ?? [];
            return (
              <View style={styles.setRowWrap}>
                <View style={styles.setRow} testID={`set-row-${item.id}`}>
                  <Text style={styles.setIndex}>#{index + 1}</Text>
                  <Text style={styles.setTypeChip} testID={`set-type-${item.id}`}>
                    {getSetTypeLabel(item.set_type, true)}
                  </Text>
                  <View style={styles.setMetric}>
                    <TextInput
                      style={styles.setMetricInput}
                      value={
                        setDrafts[item.id]?.weight ??
                        (item.weight !== null ? formatWeightInput(item.weight) : '')
                      }
                      onChangeText={(next) => updateSetDraft(item.id, 'weight', next)}
                      onBlur={() => void commitSetWeightInput(item)}
                      onSubmitEditing={() => void commitSetWeightInput(item)}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      placeholder="—"
                      placeholderTextColor={T.muted}
                      selectTextOnFocus
                      maxLength={7}
                      testID={`set-weight-input-${item.id}`}
                    />
                    <Text style={styles.setUnit}>{item.unit}</Text>
                  </View>
                  <View style={styles.setMetric}>
                    <TextInput
                      style={styles.setMetricInput}
                      value={
                        setDrafts[item.id]?.reps ?? (item.reps !== null ? String(item.reps) : '')
                      }
                      onChangeText={(next) => updateSetDraft(item.id, 'reps', next)}
                      onBlur={() => void commitSetRepsInput(item)}
                      onSubmitEditing={() => void commitSetRepsInput(item)}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      placeholder="—"
                      placeholderTextColor={T.muted}
                      selectTextOnFocus
                      maxLength={3}
                      testID={`set-reps-input-${item.id}`}
                    />
                    <Text style={styles.setUnit}>reps</Text>
                  </View>
                  <Text style={styles.setRpe}>{item.rpe !== null ? `RPE ${item.rpe}` : '—'}</Text>
                  <View style={styles.setCheck}>
                    <Ionicons name="checkmark" size={14} color={T.success} />
                  </View>
                  <View style={styles.setActions}>
                    <TouchableOpacity
                      style={styles.setActionBtn}
                      onPress={() => openEditSet(item)}
                      hitSlop={6}
                      testID={`edit-set-btn-${item.id}`}
                    >
                      <Ionicons name="create-outline" size={14} color={T.textDim} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setActionBtn}
                      onPress={() => handleDeleteSet(item)}
                      hitSlop={6}
                    >
                      <Ionicons name="trash-outline" size={14} color={T.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
                {rowPotentialPRs.length > 0 && (
                  <View style={styles.potentialPrLine} testID={`potential-pr-${item.id}`}>
                    <Ionicons name="sparkles-outline" size={12} color={T.accent} />
                    <Text style={styles.potentialPrText}>
                      {formatPotentialPRLine(rowPotentialPRs)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addExSmallBtn}
              onPress={() => setPickerVisible(true)}
              testID="add-exercise-tab"
            >
              <Ionicons name="add" size={15} color={T.muted} />
              <Text style={styles.addExSmallText}>Add exercise</Text>
            </TouchableOpacity>
          }
        />
      )}

      {/* ── Logger (pinned bottom) ───────────────────────────── */}
      {exercises.length > 0 && activeExercise && (
        <View style={styles.loggerBlock}>
          {ENABLE_TYPED_VOICE_DEBUG && (
            <View style={styles.voiceDebug}>
              <View style={styles.voiceInputRow}>
                <TextInput
                  style={styles.voiceInput}
                  value={voiceText}
                  onChangeText={setVoiceText}
                  placeholder="Typed voice debug"
                  placeholderTextColor={T.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleVoiceDebugSubmit}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.voiceRunBtn} onPress={handleVoiceDebugSubmit}>
                  <Ionicons name="play" size={14} color={T.accentInk} />
                </TouchableOpacity>
              </View>
              <VoiceConfirm result={voiceResult} />
              {voiceResult?.confidence === 'medium' || voiceResult?.intent === 'end_workout' ? (
                <TouchableOpacity
                  style={styles.voiceConfirmBtn}
                  onPress={() => voiceResult && void commitVoiceResult(voiceResult)}
                >
                  <Text style={styles.voiceConfirmText}>Confirm</Text>
                </TouchableOpacity>
              ) : null}
              {voiceMessage && <Text style={styles.voiceMessage}>{voiceMessage}</Text>}
            </View>
          )}

          {/* Suggestion line */}
          <TouchableOpacity
            style={styles.suggestionRow}
            disabled={!suggestionHasValue}
            onPress={() => {
              if (suggestion.weight !== null) setWeight(suggestion.weight);
              if (suggestion.reps !== null) setReps(suggestion.reps);
              setRpe(null);
            }}
            testID="suggestion-row"
          >
            <View style={styles.suggestionDot} />
            <Text style={styles.suggestionText} numberOfLines={1}>
              Suggest ·{' '}
              <Text style={styles.suggestionValue}>
                {suggestionHasValue
                  ? `${suggestion.weight ?? '—'} × ${suggestion.reps ?? '—'}`
                  : suggestionReason}
              </Text>
              {suggestionHasValue ? ` · ${suggestionReason}` : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.nextSetHeader}>
            <Text style={styles.nextSetLabel}>NEXT SET</Text>
            <Text style={styles.nextSetValue} numberOfLines={1}>
              {nextSetSummary}
            </Text>
          </View>

          <View style={styles.setTypeRow}>
            {SET_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.setTypeBtn, setType === option.value && styles.setTypeBtnActive]}
                onPress={() => setSetType(option.value)}
                testID={`set-type-option-${option.value}`}
              >
                <Text
                  style={[
                    styles.setTypeBtnText,
                    setType === option.value && styles.setTypeBtnTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Steppers */}
          <View style={styles.steppersRow}>
            <View style={styles.stepperWrap}>
              <Text style={styles.stepperLabel}>WEIGHT · KG</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepperBtn, styles.stepperBtnLeft]}
                  onPress={() => setWeight((w) => Math.max(0, parseFloat((w - 2.5).toFixed(2))))}
                  onLongPress={() => setWeight((w) => Math.max(0, parseFloat((w - 10).toFixed(2))))}
                  delayLongPress={400}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <TextInput
                    style={styles.stepperValueInput}
                    value={weightInput}
                    onChangeText={(next) => {
                      setWeightInput(next);
                      const parsed = parseNonNegativeNumber(next);
                      if (parsed !== null) setWeight(parseFloat(parsed.toFixed(2)));
                    }}
                    onBlur={() => {
                      setIsWeightInputFocused(false);
                      commitWeightInput();
                    }}
                    onFocus={() => setIsWeightInputFocused(true)}
                    onSubmitEditing={commitWeightInput}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    maxLength={7}
                    testID="weight-input"
                  />
                  <Text style={styles.stepperUnit}>kg</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepperBtn, styles.stepperBtnRight]}
                  onPress={() => setWeight((w) => parseFloat((w + 2.5).toFixed(2)))}
                  onLongPress={() => setWeight((w) => parseFloat((w + 10).toFixed(2)))}
                  delayLongPress={400}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperWrap}>
              <Text style={styles.stepperLabel}>REPS</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepperBtn, styles.stepperBtnLeft]}
                  onPress={() => setReps((r) => Math.max(1, r - 1))}
                  onLongPress={() => setReps((r) => Math.max(1, r - 5))}
                  delayLongPress={400}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepperValueWrap}>
                  <TextInput
                    style={styles.stepperValueInput}
                    value={repsInput}
                    onChangeText={(next) => {
                      setRepsInput(next);
                      const parsed = parsePositiveInteger(next);
                      if (parsed !== null) setReps(parsed);
                    }}
                    onBlur={() => {
                      setIsRepsInputFocused(false);
                      commitRepsInput();
                    }}
                    onFocus={() => setIsRepsInputFocused(true)}
                    onSubmitEditing={commitRepsInput}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    maxLength={3}
                    testID="reps-input"
                  />
                  <Text style={styles.stepperUnit}>rps</Text>
                </View>
                <TouchableOpacity
                  style={[styles.stepperBtn, styles.stepperBtnRight]}
                  onPress={() => setReps((r) => r + 1)}
                  onLongPress={() => setReps((r) => r + 5)}
                  delayLongPress={400}
                >
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
            <MicButton />
          </View>
        </View>
      )}

      <ExercisePicker
        visible={pickerVisible}
        onSelect={(ex) => {
          addExercise({
            id: ex.id,
            name: ex.name,
            category: ex.category,
            default_unit: ex.default_unit,
          });
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
            targetSets={activeExercise?.targetSets ?? null}
            targetWeight={activeExercise?.targetWeight ?? null}
            progressionRule={activeExercise?.progressionRule ?? { rule: 'none' }}
            progressionExercise={
              activeExercise?.progressionExercise ?? {
                category: activeExercise?.category ?? 'barbell',
              }
            }
            defaultUnit={activeExercise?.defaultUnit ?? 'kg'}
            onClose={() => setHistoryVisible(false)}
            onApplySuggestion={(next) => {
          if (next.weight !== null) setWeight(next.weight);
          if (next.reps !== null) setReps(next.reps);
          setRpe(null);
        }}
      />

      <Modal
        visible={summaryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSummaryVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.summarySheet} testID="workout-summary-modal">
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Workout Summary</Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSummaryVisible(false)}
                hitSlop={8}
                testID="summary-close-btn"
              >
                <Ionicons name="close" size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Elapsed</Text>
                <Text style={styles.summaryStatValue} testID="summary-elapsed">
                  {formatElapsed(elapsedSecs)}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Total Sets</Text>
                <Text style={styles.summaryStatValue} testID="summary-total-sets">
                  {liveSummary.totalSets}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Working Sets</Text>
                <Text style={styles.summaryStatValue} testID="summary-working-sets">
                  {liveSummary.workingSets}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Volume</Text>
                <Text style={styles.summaryStatValue} testID="summary-total-volume">
                  {liveSummary.totalVolume.toLocaleString()} kg
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatLabel}>Working Volume</Text>
                <Text style={styles.summaryStatValue} testID="summary-working-volume">
                  {liveSummary.workingVolume.toLocaleString()} kg
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.summaryScroll}
              contentContainerStyle={styles.summaryExerciseList}
            >
              <Text style={styles.summarySectionLabel}>Exercises</Text>
              {liveSummary.exercises.length === 0 ? (
                <Text style={styles.summaryEmpty}>No sets logged yet.</Text>
              ) : (
                liveSummary.exercises.map(
                  ({ exercise, completedSets, remainingSets, state, target }) => (
                    <View key={exercise.id} style={styles.summaryExerciseCard}>
                      <View style={styles.summaryExerciseHeader}>
                        <Text style={styles.summaryExerciseName} numberOfLines={1}>
                          {exercise.name}
                        </Text>
                        <Text style={styles.summaryExerciseState}>{state}</Text>
                      </View>
                      {target !== null && (
                        <Text style={styles.summaryTarget}>Target: {target}</Text>
                      )}
                      <Text style={styles.summaryDoneLabel}>Done:</Text>
                      {completedSets.length === 0 ? (
                        <Text style={styles.summaryEmpty}>None</Text>
                      ) : (
                        completedSets.map((set, index) => (
                          <Text key={set.id} style={styles.summarySetLine}>
                            {index + 1}. {set.weight ?? '—'} × {set.reps ?? '—'}{' '}
                            {getSetTypeLabel(set.set_type)}
                          </Text>
                        ))
                      )}
                      {remainingSets !== null && (
                        <Text style={styles.summaryLeft} testID={`summary-left-${exercise.id}`}>
                          Left: {remainingSets} working {remainingSets === 1 ? 'set' : 'sets'}
                        </Text>
                      )}
                    </View>
                  ),
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setEditingSet(null)}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <View style={styles.steppersRow}>
              <View style={styles.stepperWrap}>
                <Text style={styles.stepperLabel}>
                  WEIGHT · {editingSet?.unit.toUpperCase() ?? 'KG'}
                </Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, styles.stepperBtnLeft]}
                    onPress={() =>
                      setEditWeight((w) => Math.max(0, parseFloat((w - 2.5).toFixed(2))))
                    }
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueWrap}>
                    <Text style={styles.stepperValue}>
                      {editWeight % 1 === 0 ? editWeight : editWeight.toFixed(1)}
                    </Text>
                    <Text style={styles.stepperUnit}>{editingSet?.unit ?? 'kg'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepperBtn, styles.stepperBtnRight]}
                    onPress={() => setEditWeight((w) => parseFloat((w + 2.5).toFixed(2)))}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.stepperWrap}>
                <Text style={styles.stepperLabel}>REPS</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, styles.stepperBtnLeft]}
                    onPress={() => setEditReps((r) => Math.max(1, r - 1))}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepperValueWrap}>
                    <Text style={styles.stepperValue}>{editReps}</Text>
                    <Text style={styles.stepperUnit}>rps</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepperBtn, styles.stepperBtnRight]}
                    onPress={() => setEditReps((r) => r + 1)}
                  >
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
                  <Text style={[styles.rpeChipText, editRpe === value && styles.rpeChipTextActive]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editSetTypeBlock}>
              <Text style={styles.stepperLabel}>SET TYPE</Text>
              <View style={styles.setTypeRow}>
                {SET_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.setTypeBtn,
                      editSetType === option.value && styles.setTypeBtnActive,
                    ]}
                    onPress={() => setEditSetType(option.value)}
                    testID={`edit-set-type-option-${option.value}`}
                  >
                    <Text
                      style={[
                        styles.setTypeBtnText,
                        editSetType === option.value && styles.setTypeBtnTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveEditBtn}
              onPress={() => void handleSaveEdit()}
              testID="save-edit-set-btn"
            >
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  topActionBtn: {
    minWidth: 86,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
  },
  topActionText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  finishBtn: { backgroundColor: T.accent, borderColor: T.accent },
  finishBtnText: { color: T.accentInk },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elapsedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: T.accent },
  elapsedText: {
    fontFamily: 'Courier New',
    fontSize: 13,
    color: T.text,
    letterSpacing: 0.5,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  arrowBtnDisabled: { opacity: 0.3 },
  carouselCenter: { flex: 1, alignItems: 'center' },
  carouselEyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  carouselName: {
    fontSize: 19,
    fontWeight: '600',
    color: T.text,
    letterSpacing: -0.3,
    marginTop: 4,
    textAlign: 'center',
  },
  restTimerPanel: {
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  restTimerMain: { flex: 1, minWidth: 0 },
  restTimerLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.accent,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  restTimerValue: {
    fontFamily: 'Courier New',
    fontSize: 22,
    color: T.text,
    fontWeight: '700',
    marginTop: 1,
  },
  restTimerExercise: {
    color: T.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  restTimerActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  restTimerActionBtn: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.borderBright,
    backgroundColor: T.surface2,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerActionText: { color: T.text, fontSize: 12, fontWeight: '700' },
  manualRestLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.muted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  manualRestOptions: { gap: 6, alignItems: 'center' },
  manualRestBtn: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.borderBright,
    backgroundColor: T.surface2,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualRestBtnText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  manualRestBtnActive: { backgroundColor: T.text, borderColor: T.text },
  manualRestBtnTextActive: { color: T.bg },

  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8 },

  targetCard: {
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.borderBright,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  targetLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.accent,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  targetValue: {
    color: T.text,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 6,
  },
  targetCompletion: {
    fontFamily: 'Courier New',
    color: T.textDim,
    fontSize: 12.5,
    marginTop: 5,
  },

  lastTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  lastTimeBody: { flex: 1, minWidth: 0 },
  lastTimeLabel: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: T.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  lastTimeData: { fontFamily: 'Courier New', fontSize: 12, color: T.text, marginTop: 2 },

  setsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setsLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  undoBtnText: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    color: T.textDim,
    letterSpacing: 0.3,
  },

  setRowWrap: { marginBottom: 6 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
  },
  setIndex: { fontFamily: 'Courier New', fontSize: 12, color: T.muted, width: 32 },
  setTypeChip: {
    width: 62,
    fontFamily: 'Courier New',
    fontSize: 9.5,
    color: T.textDim,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 7,
    paddingVertical: 4,
    marginRight: 8,
    overflow: 'hidden',
  },
  setMetric: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 0,
  },
  setMetricInput: {
    flexShrink: 1,
    minWidth: 22,
    padding: 0,
    margin: 0,
    fontFamily: 'Courier New',
    fontSize: 15,
    fontWeight: '500',
    color: T.text,
    lineHeight: 18,
  },
  setRpe: { flex: 0.8, fontFamily: 'Courier New', fontSize: 12, color: T.textDim },
  setUnit: { fontSize: 10, color: T.muted },
  setCheck: { width: 28, alignItems: 'center' },
  setActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  setActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  potentialPrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 8,
  },
  potentialPrLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 5,
  },
  potentialPrText: {
    flex: 1,
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 10.5,
  },

  emptySetRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptySetText: { fontFamily: 'Courier New', fontSize: 12, color: T.muted },

  addExSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    marginTop: 10,
  },
  addExSmallText: { fontSize: 12, color: T.muted, fontWeight: '500' },

  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addExBtnText: { fontSize: 15, fontWeight: '600', color: T.accentInk },
  mutedText: { color: T.muted, fontSize: 14 },

  loggerBlock: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: T.accent,
    flexShrink: 0,
  },
  suggestionText: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    color: T.textDim,
    letterSpacing: 0.2,
    flex: 1,
  },
  suggestionValue: { color: T.text },
  nextSetHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  nextSetLabel: {
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 0,
    textTransform: 'uppercase',
    color: T.text,
    fontWeight: '700',
  },
  nextSetValue: {
    flex: 1,
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 12,
    textAlign: 'right',
  },

  setTypeRow: { flexDirection: 'row', gap: 6 },
  setTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  setTypeBtnActive: { backgroundColor: T.text, borderColor: T.text },
  setTypeBtnText: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  setTypeBtnTextActive: { color: T.bg },

  steppersRow: { flexDirection: 'row', gap: 8 },
  stepperWrap: { flex: 1, gap: 6 },
  stepperLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 44,
    flexShrink: 0,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLeft: { borderRightWidth: 1, borderRightColor: T.border },
  stepperBtnRight: { borderLeftWidth: 1, borderLeftColor: T.border },
  stepperBtnText: { color: T.text, fontSize: 22, lineHeight: 26 },
  stepperValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  stepperValueInput: {
    minWidth: 40,
    maxWidth: 86,
    padding: 0,
    margin: 0,
    fontFamily: 'Courier New',
    fontSize: 28,
    fontWeight: '500',
    color: T.text,
    lineHeight: 32,
    textAlign: 'center',
  },
  stepperValue: {
    fontFamily: 'Courier New',
    fontSize: 28,
    fontWeight: '500',
    color: T.text,
    lineHeight: 32,
  },
  stepperUnit: { fontFamily: 'Courier New', fontSize: 11, color: T.muted, letterSpacing: 0.3 },

  rpeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rpeLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.muted,
    letterSpacing: 0.5,
    marginRight: 4,
    flexShrink: 0,
  },
  rpeChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  rpeChipActive: { backgroundColor: T.text, borderColor: T.text },
  rpeChipText: { fontFamily: 'Courier New', fontSize: 11, fontWeight: '500', color: T.textDim },
  rpeChipTextActive: { color: T.bg },

  logRow: { flexDirection: 'row', gap: 8 },
  logBtn: {
    flex: 1,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  logBtnPressed: { shadowOpacity: 0.15, shadowRadius: 4 },
  logBtnText: { fontSize: 16, fontWeight: '700', color: T.accentInk, letterSpacing: 0.1 },
  voiceDebug: { gap: 8 },
  voiceInputRow: { flexDirection: 'row', gap: 8 },
  voiceInput: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  voiceRunBtn: {
    width: 42,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceConfirmBtn: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  voiceConfirmText: { color: T.text, fontSize: 12, fontWeight: '700' },
  voiceMessage: { color: T.textDim, fontFamily: 'Courier New', fontSize: 11 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  summarySheet: {
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 16,
    maxHeight: '86%',
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryStat: {
    width: '31%',
    minWidth: 96,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  summaryStatLabel: {
    fontFamily: 'Courier New',
    fontSize: 10,
    color: T.muted,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  summaryStatValue: {
    color: T.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 5,
  },
  summaryScroll: { maxHeight: 420 },
  summaryExerciseList: { gap: 8 },
  summarySectionLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryEmpty: { color: T.textDim, fontSize: 14 },
  summaryExerciseCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  summaryExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryExerciseName: { flex: 1, color: T.text, fontSize: 14, fontWeight: '600' },
  summaryExerciseState: {
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  summaryTarget: { color: T.textDim, fontSize: 12 },
  summaryDoneLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  summarySetLine: { color: T.text, fontFamily: 'Courier New', fontSize: 12 },
  summaryLeft: { color: T.textDim, fontSize: 12, fontWeight: '600' },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editTitle: { color: T.text, fontSize: 18, fontWeight: '700' },
  editSetTypeBlock: { gap: 7 },
  saveEditBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditText: { color: T.accentInk, fontSize: 15, fontWeight: '700' },
});
