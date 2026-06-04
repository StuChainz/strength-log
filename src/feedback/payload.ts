import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getSessionRecovery, type SessionRecovery } from '@/db/repositories/sessions.repo';
import appConfig from '../../app.json';

export const FEEDBACK_TYPES = ['Bug', 'Suggestion', 'Question'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackSource = 'settings' | 'workout_summary' | 'home_overflow';

interface FeedbackInput {
  feedbackType: FeedbackType;
  message: string;
  currentRoute: string;
  source: FeedbackSource;
}

interface AppMetadata {
  version: string;
  buildNumber: string | null;
}

interface DeviceMetadata {
  platform: string;
  osVersion: string;
  model: string;
  isDevice: boolean | null;
}

export interface ActiveWorkoutState {
  status: SessionRecovery['status'];
  activeSessionCount: number;
  sessionId: string | null;
  templateId: string | null;
  sessionStatus: 'in_progress' | null;
  startedAt: string | null;
  updatedAt: string | null;
  elapsedMinutes: number | null;
  setCount: number;
  exerciseCount: number;
  lastSetLoggedAt: string | null;
}

export interface RecentDiagnosticReport {
  generatedAt: string;
  databaseReachable: boolean;
  activeRecoveryStatus: SessionRecovery['status'];
  counts: {
    workoutSessions: number | null;
    activeSessions: number | null;
    completedSessions: number | null;
    workoutSets: number | null;
    workoutEvents: number | null;
    templates: number | null;
    exercises: number | null;
  };
  recentWorkoutEventCount: number | null;
  warnings: string[];
}

export interface FeedbackPayload {
  schemaVersion: 1;
  createdAt: string;
  feedbackType: FeedbackType;
  message: string;
  app: AppMetadata;
  device: DeviceMetadata;
  context: {
    currentRoute: string;
    source: FeedbackSource;
  };
  workout: {
    activeWorkoutState: ActiveWorkoutState;
    lastCompletedWorkoutId: string | null;
  };
  recentDiagnosticReport: RecentDiagnosticReport;
}

interface ActiveSetStatsRow {
  setCount: number | null;
  exerciseCount: number | null;
  lastSetLoggedAt: number | null;
}

interface CountRow {
  value: number | null;
}

interface LastCompletedRow {
  id: string;
}

type FeedbackSqlParam = string | number | null | boolean | Uint8Array;

const expoConfig = appConfig.expo as {
  version?: string;
  ios?: { buildNumber?: string };
  android?: { versionCode?: string | number };
};

function toIso(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value).toISOString()
    : null;
}

function getBuildNumberFallback(): string | null {
  const platformBuild = Platform.select<string | null>({
    ios: expoConfig.ios?.buildNumber ?? null,
    android:
      expoConfig.android?.versionCode !== undefined
        ? String(expoConfig.android.versionCode)
        : null,
    default: null,
  });
  return platformBuild ?? null;
}

export function getFeedbackAppMetadata(): AppMetadata {
  return {
    version: Application.nativeApplicationVersion ?? expoConfig.version ?? 'unknown',
    buildNumber: Application.nativeBuildVersion ?? getBuildNumberFallback(),
  };
}

function getDeviceModelFallback(): string {
  if (Platform.OS === 'android') {
    const constants = Platform.constants as Record<string, unknown>;
    const manufacturer = typeof constants.Manufacturer === 'string' ? constants.Manufacturer : '';
    const model = typeof constants.Model === 'string' ? constants.Model : '';
    return [manufacturer, model].filter(Boolean).join(' ') || 'Android device';
  }

  if (Platform.OS === 'ios') {
    const constants = Platform.constants as Record<string, unknown>;
    const idiom = typeof constants.interfaceIdiom === 'string' ? constants.interfaceIdiom : '';
    return idiom ? `iOS ${idiom}` : 'iOS device';
  }

  return `${Platform.OS} device`;
}

export function getFeedbackDeviceMetadata(): DeviceMetadata {
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');

  return {
    platform: Platform.OS,
    osVersion: String(Platform.Version),
    model: model || getDeviceModelFallback(),
    isDevice: typeof Device.isDevice === 'boolean' ? Device.isDevice : null,
  };
}

async function readActiveWorkoutState(
  db: SQLiteDatabase,
  recovery: SessionRecovery,
  now: number,
): Promise<ActiveWorkoutState> {
  if (recovery.status === 'none') {
    return {
      status: 'none',
      activeSessionCount: 0,
      sessionId: null,
      templateId: null,
      sessionStatus: null,
      startedAt: null,
      updatedAt: null,
      elapsedMinutes: null,
      setCount: 0,
      exerciseCount: 0,
      lastSetLoggedAt: null,
    };
  }

  const session = recovery.session;
  const stats = await db.getFirstAsync<ActiveSetStatsRow>(
    `SELECT COUNT(id) AS setCount,
            COUNT(DISTINCT exercise_id) AS exerciseCount,
            MAX(logged_at) AS lastSetLoggedAt
       FROM workout_sets
      WHERE session_id = ?
        AND deleted_at IS NULL`,
    [session.id],
  );

  return {
    status: recovery.status,
    activeSessionCount: recovery.sessions.length,
    sessionId: session.id,
    templateId: session.template_id,
    sessionStatus: 'in_progress',
    startedAt: toIso(session.started_at),
    updatedAt: toIso(session.updated_at),
    elapsedMinutes: Math.max(0, Math.round((now - session.started_at) / 60000)),
    setCount: Number(stats?.setCount ?? 0),
    exerciseCount: Number(stats?.exerciseCount ?? 0),
    lastSetLoggedAt: toIso(stats?.lastSetLoggedAt),
  };
}

async function safeCount(
  db: SQLiteDatabase,
  sql: string,
  params: FeedbackSqlParam[],
  warnings: string[],
  label: string,
): Promise<number | null> {
  try {
    const row = await db.getFirstAsync<CountRow>(sql, params);
    return Number(row?.value ?? 0);
  } catch {
    warnings.push(`count:${label}`);
    return null;
  }
}

async function readLastCompletedWorkoutId(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<LastCompletedRow>(
    `SELECT id
       FROM workout_sessions
      WHERE status = 'completed'
      ORDER BY ended_at DESC, updated_at DESC
      LIMIT 1`,
  );

  return row?.id ?? null;
}

async function readDiagnosticReport(
  db: SQLiteDatabase,
  recovery: SessionRecovery,
  now: number,
): Promise<RecentDiagnosticReport> {
  const warnings: string[] = [];
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const [
    workoutSessions,
    activeSessions,
    completedSessions,
    workoutSets,
    workoutEvents,
    templates,
    exercises,
    recentWorkoutEventCount,
  ] = await Promise.all([
    safeCount(db, 'SELECT COUNT(*) AS value FROM workout_sessions', [], warnings, 'sessions'),
    safeCount(
      db,
      "SELECT COUNT(*) AS value FROM workout_sessions WHERE status = 'in_progress'",
      [],
      warnings,
      'activeSessions',
    ),
    safeCount(
      db,
      "SELECT COUNT(*) AS value FROM workout_sessions WHERE status = 'completed'",
      [],
      warnings,
      'completedSessions',
    ),
    safeCount(db, 'SELECT COUNT(*) AS value FROM workout_sets', [], warnings, 'sets'),
    safeCount(db, 'SELECT COUNT(*) AS value FROM workout_events', [], warnings, 'events'),
    safeCount(db, 'SELECT COUNT(*) AS value FROM templates', [], warnings, 'templates'),
    safeCount(db, 'SELECT COUNT(*) AS value FROM exercises', [], warnings, 'exercises'),
    safeCount(
      db,
      'SELECT COUNT(*) AS value FROM workout_events WHERE created_at >= ?',
      [oneDayAgo],
      warnings,
      'recentEvents',
    ),
  ]);

  return {
    generatedAt: new Date(now).toISOString(),
    databaseReachable: true,
    activeRecoveryStatus: recovery.status,
    counts: {
      workoutSessions,
      activeSessions,
      completedSessions,
      workoutSets,
      workoutEvents,
      templates,
      exercises,
    },
    recentWorkoutEventCount,
    warnings,
  };
}

export async function createFeedbackPayload(
  db: SQLiteDatabase,
  input: FeedbackInput,
  now = Date.now(),
): Promise<FeedbackPayload> {
  const recovery = await getSessionRecovery(db, now);
  const [activeWorkoutState, lastCompletedWorkoutId, recentDiagnosticReport] =
    await Promise.all([
      readActiveWorkoutState(db, recovery, now),
      readLastCompletedWorkoutId(db),
      readDiagnosticReport(db, recovery, now),
    ]);

  return {
    schemaVersion: 1,
    createdAt: new Date(now).toISOString(),
    feedbackType: input.feedbackType,
    message: input.message.trim(),
    app: getFeedbackAppMetadata(),
    device: getFeedbackDeviceMetadata(),
    context: {
      currentRoute: input.currentRoute,
      source: input.source,
    },
    workout: {
      activeWorkoutState,
      lastCompletedWorkoutId,
    },
    recentDiagnosticReport,
  };
}

export function formatFeedbackPayload(payload: FeedbackPayload): string {
  return JSON.stringify(payload, null, 2);
}
