import { useCallback, useEffect, useRef, useState } from 'react';
import { openDb } from '@/db/client';
import { newId } from '@/domain/ids';
import {
  getSessionRecovery,
  createSession,
  endSession as dbEndSession,
  discardSession as dbDiscardSession,
  type SessionRecovery,
} from '@/db/repositories/sessions.repo';
import { getTemplateItemsWithExercise } from '@/db/repositories/templates.repo';
import { insertEvent } from '@/db/repositories/events.repo';
import {
  insertSet,
  rebuildSets,
  getSetsBySession,
  updateSet,
  softDeleteSet,
} from '@/db/repositories/sets.repo';
import {
  updateExerciseHistoryCache,
  updateSessionExerciseHistoryCache,
} from '@/db/repositories/history.repo';
import { detectAndInsertFinalPrsForSession } from '@/db/repositories/prs.repo';
import { calculateSessionVolume } from '@/domain/volume';
import type { WorkoutSession, WorkoutSet, ExerciseCategory, Unit, SetType } from '@/domain/types';
import type { ProgressionExercise, ProgressionRuleConfig } from '@/domain/progression';
import type { SetAddedPayload, SetDeletedPayload, SetEditedPayload } from '@/domain/events';
import type { SQLiteDatabase } from 'expo-sqlite';

export interface SessionExercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  defaultUnit: Unit | null;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  note: string | null;
  amrapLastSet?: boolean;
  progressionRule?: ProgressionRuleConfig;
  progressionExercise?: ProgressionExercise;
}

export interface LogSetParams {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  setType?: SetType;
  source?: 'tap' | 'voice';
  setId?: string;
  clientSetId?: string;
  clientEventId?: string;
}

export type StorePhase = 'loading' | 'prompt_resume' | 'active' | 'ended' | 'error';

export interface UseSessionStoreReturn {
  phase: StorePhase;
  session: WorkoutSession | null;
  existingSession: WorkoutSession | null;
  recovery: SessionRecovery | null;
  resumedStartedAt: number | null;
  exercises: SessionExercise[];
  sets: WorkoutSet[];
  activeExerciseId: string | null;
  setActiveExerciseId: (id: string) => void;
  logSet: (params: LogSetParams) => Promise<void>;
  editSet: (
    setId: string,
    fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit' | 'set_type'>>,
  ) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  undoLastSet: () => Promise<void>;
  endWorkout: () => Promise<void>;
  discardWorkout: () => Promise<void>;
  resumeExisting: () => Promise<void>;
  endExisting: () => Promise<void>;
  discardExisting: () => Promise<void>;
  discardAndStart: () => Promise<void>;
  addExercise: (exercise: {
    id: string;
    name: string;
    category: ExerciseCategory;
    default_unit: Unit | null;
  }) => void;
}

async function loadExercisesForTemplate(
  db: SQLiteDatabase,
  templateId: string,
): Promise<SessionExercise[]> {
  const items = await getTemplateItemsWithExercise(db, templateId);
  return items.map((item) => {
    const equipment =
      item.exercise_equipment_json !== null
        ? (JSON.parse(item.exercise_equipment_json) as string[])
        : [];

    return {
      id: item.exercise_id,
      name: item.exercise_name,
      category: item.exercise_category,
      defaultUnit: item.exercise_default_unit,
      targetSets: item.target_sets,
      targetReps: item.target_reps,
      targetWeight: item.target_weight,
      targetRpe: item.target_rpe,
      restSeconds: item.rest_seconds,
      note: item.note,
      amrapLastSet: item.amrap_last_set === 1,
      progressionRule: {
        rule: item.progression_rule ?? 'none',
        incrementKg: item.increment_kg,
        incrementLb: item.increment_lb,
        repRangeMin: item.rep_range_min,
        repRangeMax: item.rep_range_max,
        rpeCap: item.rpe_cap,
      },
      progressionExercise: {
        category: item.exercise_category,
        movementPattern: item.exercise_movement_pattern,
        bodyRegion: item.exercise_body_region,
        mechanics: item.exercise_mechanics,
        equipment,
      },
    };
  });
}

async function loadExercisesFromSets(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<SessionExercise[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    category: ExerciseCategory;
    defaultUnit: Unit | null;
    targetSets: null;
    targetReps: null;
    targetWeight: null;
    targetRpe: null;
    restSeconds: null;
    note: null;
  }>(
    `SELECT e.id, e.name, e.category, e.default_unit AS defaultUnit,
            NULL AS targetSets, NULL AS targetReps, NULL AS targetWeight, NULL AS targetRpe,
            NULL AS restSeconds, NULL AS note
     FROM (
       SELECT exercise_id, MIN(position) AS min_pos
       FROM workout_sets
       WHERE session_id = ? AND deleted_at IS NULL
       GROUP BY exercise_id
     ) ws
     JOIN exercises e ON e.id = ws.exercise_id
     ORDER BY ws.min_pos ASC`,
    [sessionId],
  );

  return rows.map((row) => ({
    ...row,
    progressionRule: { rule: 'none' },
    progressionExercise: { category: row.category },
  }));
}

async function recordFinalPrsSafely(db: SQLiteDatabase, sessionId: string): Promise<void> {
  try {
    await detectAndInsertFinalPrsForSession(db, sessionId);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      // Workout completion is the source of truth; PR indexing can be retried.
      // eslint-disable-next-line no-console
      console.warn('Final PR detection failed', error);
    }
  }
}

function startErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSessionStore(templateId: string | undefined): UseSessionStoreReturn {
  const [phase, setPhase] = useState<StorePhase>('loading');
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [existingSession, setExistingSession] = useState<WorkoutSession | null>(null);
  const [recovery, setRecovery] = useState<SessionRecovery | null>(null);
  const [resumedStartedAt, setResumedStartedAt] = useState<number | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const dbRef = useRef<SQLiteDatabase | null>(null);

  const initSession = useCallback(async (sess: WorkoutSession, db: SQLiteDatabase) => {
    await rebuildSets(db, sess.id);
    const loadedSets = await getSetsBySession(db, sess.id);
    setSets(loadedSets);

    let exs: SessionExercise[] = [];
    if (sess.template_id) {
      exs = await loadExercisesForTemplate(db, sess.template_id);
    } else {
      exs = await loadExercisesFromSets(db, sess.id);
    }
    setExercises(exs);
    setActiveExerciseId(exs[0]?.id ?? null);
    setSession(sess);
    setPhase('active');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await openDb();
      if (cancelled) return;
      dbRef.current = db;

      const recovered = await getSessionRecovery(db);
      if (cancelled) return;

      if (recovered.status !== 'none') {
        setRecovery(recovered);
        setExistingSession(recovered.session);
        setPhase('prompt_resume');
        return;
      }

      const sess = await createSession(db, {
        templateId: templateId ?? null,
        name: null,
      });
      if (cancelled) return;

      if (templateId) {
        const exs = await loadExercisesForTemplate(db, templateId);
        if (!cancelled) {
          setExercises(exs);
          setActiveExerciseId(exs[0]?.id ?? null);
        }
      }
      if (!cancelled) {
        setSession(sess);
        setPhase('active');
      }
    })().catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[session] start failed', startErrorMessage(error));
      }
      if (!cancelled) setPhase('error');
    });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const resumeExisting = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    await initSession(existingSession, db);
    setResumedStartedAt(existingSession.started_at);
    setExistingSession(null);
    setRecovery(null);
  }, [existingSession, initSession]);

  const endExisting = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    await dbEndSession(db, existingSession.id, null);
    await updateSessionExerciseHistoryCache(db, existingSession.id);
    await recordFinalPrsSafely(db, existingSession.id);
    setExistingSession(null);
    setRecovery(null);
    setPhase('ended');
  }, [existingSession]);

  const discardExisting = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    await dbDiscardSession(db, existingSession.id);
    setExistingSession(null);
    setRecovery(null);
    setPhase('ended');
  }, [existingSession]);

  const discardAndStart = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    try {
      const sessionsToDiscard =
        recovery?.status === 'none' ? [existingSession] : (recovery?.sessions ?? [existingSession]);
      for (const sessionToDiscard of sessionsToDiscard) {
        await dbDiscardSession(db, sessionToDiscard.id);
      }
      setExistingSession(null);
      setRecovery(null);
      const sess = await createSession(db, { templateId: templateId ?? null, name: null });
      setResumedStartedAt(null);
      if (templateId) {
        const exs = await loadExercisesForTemplate(db, templateId);
        setExercises(exs);
        setActiveExerciseId(exs[0]?.id ?? null);
      }
      setSession(sess);
      setPhase('active');
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[session] discard and start failed', startErrorMessage(error));
      }
      setPhase('error');
    }
  }, [existingSession, recovery, templateId]);

  const logSet = useCallback(
    async (params: LogSetParams) => {
      const db = dbRef.current;
      if (!db || !session) return;

      const clientSetId = params.clientSetId ?? newId();
      const setId = params.setId ?? newId();
      const clientEventId = params.clientEventId ?? newId();
      const now = Date.now();
      const setType = params.setType ?? 'working';
      const isWarmup: 0 | 1 = setType === 'warmup' ? 1 : 0;

      const existingForExercise = sets.filter(
        (s) => s.exercise_id === params.exerciseId && s.deleted_at === null,
      );
      const position = existingForExercise.length;

      const payload: SetAddedPayload = {
        set_id: setId,
        exercise_id: params.exerciseId,
        weight: params.weight,
        reps: params.reps,
        rpe: params.rpe,
        unit: params.unit,
        is_warmup: isWarmup,
        set_type: setType,
        position,
        source: params.source ?? 'tap',
        client_set_id: clientSetId,
        logged_at: now,
      };

      let insertedSet = false;
      await db.withTransactionAsync(async () => {
        await insertEvent(db, {
          id: newId(),
          session_id: session.id,
          event_type: 'set_added',
          payload_json: JSON.stringify(payload),
          client_event_id: clientEventId,
        });
        insertedSet = await insertSet(db, {
          id: setId,
          session_id: session.id,
          exercise_id: params.exerciseId,
          position,
          weight: params.weight,
          reps: params.reps,
          rpe: params.rpe,
          unit: params.unit,
          is_warmup: isWarmup,
          set_type: setType,
          logged_at: now,
          source: params.source ?? 'tap',
          client_set_id: clientSetId,
        });
      });

      if (!insertedSet) return;

      const newSet: WorkoutSet = {
        id: setId,
        session_id: session.id,
        exercise_id: params.exerciseId,
        position,
        weight: params.weight,
        reps: params.reps,
        rpe: params.rpe,
        unit: params.unit,
        is_warmup: isWarmup,
        set_type: setType,
        logged_at: now,
        source: params.source ?? 'tap',
        client_set_id: clientSetId,
        deleted_at: null,
      };
      setSets((prev) => [...prev, newSet]);
    },
    [session, sets],
  );

  const editSet = useCallback(
    async (
      setId: string,
      fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit' | 'set_type'>>,
    ) => {
      const db = dbRef.current;
      if (!db || !session) return;

      const payload: SetEditedPayload = { set_id: setId };
      if (fields.weight !== undefined) payload.weight = fields.weight;
      if (fields.reps !== undefined) payload.reps = fields.reps;
      if (fields.rpe !== undefined) payload.rpe = fields.rpe;
      if (fields.unit !== undefined) payload.unit = fields.unit;
      if (fields.set_type !== undefined) payload.set_type = fields.set_type;
      if (Object.keys(payload).length === 1) return;

      await db.withTransactionAsync(async () => {
        await insertEvent(db, {
          id: newId(),
          session_id: session.id,
          event_type: 'set_edited',
          payload_json: JSON.stringify(payload),
          client_event_id: newId(),
        });
        await updateSet(db, setId, fields);
      });

      setSets((prev) => prev.map((set) => (set.id === setId ? { ...set, ...fields } : set)));

      const edited = sets.find((set) => set.id === setId);
      if (edited) await updateExerciseHistoryCache(db, edited.exercise_id);
    },
    [session, sets],
  );

  const deleteSet = useCallback(
    async (setId: string) => {
      const db = dbRef.current;
      if (!db || !session) return;

      const deletedAt = Date.now();
      const payload: SetDeletedPayload = { set_id: setId };
      const deleted = sets.find((set) => set.id === setId);

      await db.withTransactionAsync(async () => {
        await insertEvent(db, {
          id: newId(),
          session_id: session.id,
          event_type: 'set_deleted',
          payload_json: JSON.stringify(payload),
          client_event_id: newId(),
        });
        await softDeleteSet(db, setId, deletedAt);
      });

      setSets((prev) =>
        prev.map((set) => (set.id === setId ? { ...set, deleted_at: deletedAt } : set)),
      );
      if (deleted) await updateExerciseHistoryCache(db, deleted.exercise_id);
    },
    [session, sets],
  );

  const undoLastSet = useCallback(async () => {
    const last = [...sets]
      .filter((set) => set.deleted_at === null)
      .sort((a, b) => b.logged_at - a.logged_at)[0];
    if (!last) return;
    await deleteSet(last.id);
  }, [deleteSet, sets]);

  const endWorkout = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !session) return;
    const totalVolume = calculateSessionVolume(sets.filter((set) => set.deleted_at === null));
    await dbEndSession(db, session.id, totalVolume);
    await updateSessionExerciseHistoryCache(db, session.id);
    await recordFinalPrsSafely(db, session.id);
    setPhase('ended');
  }, [session, sets]);

  const discardWorkout = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !session) return;
    await dbDiscardSession(db, session.id);
    setPhase('ended');
  }, [session]);

  const addExercise = useCallback(
    (exercise: {
      id: string;
      name: string;
      category: ExerciseCategory;
      default_unit: Unit | null;
    }) => {
      setExercises((prev) => {
        if (prev.some((e) => e.id === exercise.id)) return prev;
        const next: SessionExercise = {
          id: exercise.id,
          name: exercise.name,
          category: exercise.category,
          defaultUnit: exercise.default_unit,
          targetSets: null,
          targetReps: null,
          targetWeight: null,
          targetRpe: null,
          restSeconds: null,
          note: null,
          progressionRule: { rule: 'none' },
          progressionExercise: { category: exercise.category },
        };
        return [...prev, next];
      });
      setActiveExerciseId(exercise.id);
    },
    [],
  );

  return {
    phase,
    session,
    existingSession,
    recovery,
    resumedStartedAt,
    exercises,
    sets,
    activeExerciseId,
    setActiveExerciseId,
    logSet,
    editSet,
    deleteSet,
    undoLastSet,
    endWorkout,
    discardWorkout,
    resumeExisting,
    endExisting,
    discardExisting,
    discardAndStart,
    addExercise,
  };
}
