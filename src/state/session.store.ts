import { useCallback, useEffect, useRef, useState } from 'react';
import { openDb } from '@/db/client';
import { newId } from '@/domain/ids';
import {
  getInProgressSession,
  createSession,
  endSession as dbEndSession,
  discardSession as dbDiscardSession,
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
import type { WorkoutSession, WorkoutSet, ExerciseCategory, Unit } from '@/domain/types';
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
}

export interface LogSetParams {
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
}

export type StorePhase = 'loading' | 'prompt_resume' | 'active' | 'ended';

export interface UseSessionStoreReturn {
  phase: StorePhase;
  session: WorkoutSession | null;
  existingSession: WorkoutSession | null;
  exercises: SessionExercise[];
  sets: WorkoutSet[];
  activeExerciseId: string | null;
  setActiveExerciseId: (id: string) => void;
  logSet: (params: LogSetParams) => Promise<void>;
  editSet: (setId: string, fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit'>>) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  undoLastSet: () => Promise<void>;
  endWorkout: () => Promise<void>;
  discardWorkout: () => Promise<void>;
  resumeExisting: () => Promise<void>;
  discardAndStart: () => Promise<void>;
  addExercise: (exercise: { id: string; name: string; category: ExerciseCategory; default_unit: Unit | null }) => void;
}

async function loadExercisesForTemplate(
  db: SQLiteDatabase,
  templateId: string,
): Promise<SessionExercise[]> {
  const items = await getTemplateItemsWithExercise(db, templateId);
  return items.map((item) => ({
    id: item.exercise_id,
    name: item.exercise_name,
    category: item.exercise_category,
    defaultUnit: item.exercise_default_unit,
    targetSets: item.target_sets,
    targetReps: item.target_reps,
    targetWeight: item.target_weight,
  }));
}

async function loadExercisesFromSets(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<SessionExercise[]> {
  return db.getAllAsync<SessionExercise>(
    `SELECT e.id, e.name, e.category, e.default_unit AS defaultUnit,
            NULL AS targetSets, NULL AS targetReps, NULL AS targetWeight
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
}

export function useSessionStore(templateId: string | undefined): UseSessionStoreReturn {
  const [phase, setPhase] = useState<StorePhase>('loading');
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [existingSession, setExistingSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const dbRef = useRef<SQLiteDatabase | null>(null);

  const initSession = useCallback(
    async (sess: WorkoutSession, db: SQLiteDatabase) => {
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
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await openDb();
      if (cancelled) return;
      dbRef.current = db;

      const existing = await getInProgressSession(db);
      if (cancelled) return;

      if (existing) {
        setExistingSession(existing);
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
    })().catch(() => {});

    return () => { cancelled = true; };
  }, [templateId]);

  const resumeExisting = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    await initSession(existingSession, db);
    setExistingSession(null);
  }, [existingSession, initSession]);

  const discardAndStart = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !existingSession) return;
    await dbDiscardSession(db, existingSession.id);
    setExistingSession(null);
    const sess = await createSession(db, { templateId: templateId ?? null, name: null });
    if (templateId) {
      const exs = await loadExercisesForTemplate(db, templateId);
      setExercises(exs);
      setActiveExerciseId(exs[0]?.id ?? null);
    }
    setSession(sess);
    setPhase('active');
  }, [existingSession, templateId]);

  const logSet = useCallback(
    async (params: LogSetParams) => {
      const db = dbRef.current;
      if (!db || !session) return;

      const clientSetId = newId();
      const setId = newId();
      const clientEventId = newId();
      const now = Date.now();

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
        is_warmup: 0,
        position,
        source: 'tap',
        client_set_id: clientSetId,
        logged_at: now,
      };

      await db.withTransactionAsync(async () => {
        await insertEvent(db, {
          id: newId(),
          session_id: session.id,
          event_type: 'set_added',
          payload_json: JSON.stringify(payload),
          client_event_id: clientEventId,
        });
        await insertSet(db, {
          id: setId,
          session_id: session.id,
          exercise_id: params.exerciseId,
          position,
          weight: params.weight,
          reps: params.reps,
          rpe: params.rpe,
          unit: params.unit,
          is_warmup: 0,
          logged_at: now,
          source: 'tap',
          client_set_id: clientSetId,
        });
      });

      const newSet: WorkoutSet = {
        id: setId,
        session_id: session.id,
        exercise_id: params.exerciseId,
        position,
        weight: params.weight,
        reps: params.reps,
        rpe: params.rpe,
        unit: params.unit,
        is_warmup: 0,
        logged_at: now,
        source: 'tap',
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
      fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit'>>,
    ) => {
      const db = dbRef.current;
      if (!db || !session) return;

      const payload: SetEditedPayload = { set_id: setId };
      if (fields.weight !== undefined) payload.weight = fields.weight;
      if (fields.reps !== undefined) payload.reps = fields.reps;
      if (fields.rpe !== undefined) payload.rpe = fields.rpe;
      if (fields.unit !== undefined) payload.unit = fields.unit;
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

      setSets((prev) =>
        prev.map((set) => (set.id === setId ? { ...set, ...fields } : set)),
      );

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
    await dbEndSession(db, session.id);
    await updateSessionExerciseHistoryCache(db, session.id);
    setPhase('ended');
  }, [session]);

  const discardWorkout = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !session) return;
    await dbDiscardSession(db, session.id);
    setPhase('ended');
  }, [session]);

  const addExercise = useCallback(
    (exercise: { id: string; name: string; category: ExerciseCategory; default_unit: Unit | null }) => {
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
    discardAndStart,
    addExercise,
  };
}
