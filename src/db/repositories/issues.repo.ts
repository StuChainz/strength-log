import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/domain/ids';
import {
  archiveTemplate,
  createTemplate,
  getTemplateItemsWithExercise,
  updateTemplate,
  type TemplateItemWithExercise,
} from '@/db/repositories/templates.repo';
import type {
  ExerciseIssueEvent,
  Issue,
  IssueCheckin,
  IssueExerciseLink,
  IssueExerciseLinkType,
  IssueReactionType,
  IssueRoutine,
} from '@/domain/types';

export interface IssueWithReactionCount extends Issue {
  reaction_count: number;
}

export interface ExerciseIssueEventWithNames extends ExerciseIssueEvent {
  issue_name: string;
  exercise_name: string;
}

export interface ExerciseIssueEventWithIssueName extends ExerciseIssueEvent {
  issue_name: string;
}

export interface IssueExerciseLinkWithExerciseName extends IssueExerciseLink {
  exercise_name: string;
}

export interface IssueExerciseLinkWithIssueName extends IssueExerciseLink {
  issue_name: string;
}

export interface IssueRoutineSummary extends IssueRoutine {
  routine_name: string;
  routine_note: string | null;
  exercise_count: number;
  last_completed_at: number | null;
}

export interface ExerciseIssueSummary {
  issueId: string;
  issueName: string;
  aggravatedCount: number;
  helpedCount: number;
  lastNote: string | null;
  lastCreatedAt: number;
  latestEvent: ExerciseIssueEvent;
}

export type IssueCheckinTrend =
  | { status: 'insufficient'; count: number }
  | {
      status: 'improving' | 'worsening' | 'stable';
      count: number;
      firstThreeAverage: number;
      latestThreeAverage: number;
    };

export interface IssueRoutineCompletionContext {
  routineId: string;
  templateId: string;
  completedLast30Days: number;
}

export interface CreateIssueInput {
  name: string;
  note?: string | null;
}

export interface UpdateIssueInput {
  name?: string;
  note?: string | null;
  active?: boolean;
}

export interface RecordExerciseIssueEventInput {
  issueId: string;
  exerciseId: string;
  sessionId?: string | null;
  reactionType: IssueReactionType;
  severity?: number | null;
  note?: string | null;
}

export interface UpdateExerciseIssueEventInput {
  reactionType?: IssueReactionType;
  severity?: number | null;
  note?: string | null;
}

export interface CreateIssueCheckinInput {
  issueId: string;
  severity: number;
  note?: string | null;
}

export interface CreateIssueExerciseLinkInput {
  issueId: string;
  exerciseId: string;
  linkType: IssueExerciseLinkType;
  note?: string | null;
}

export interface UpdateIssueExerciseLinkInput {
  note?: string | null;
}

export interface IssueRoutineItemInput {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  note?: string | null;
}

export interface CreateIssueRoutineInput {
  issueId: string;
  name: string;
  items: IssueRoutineItemInput[];
}

export interface UpdateIssueRoutineInput {
  name: string;
  items: IssueRoutineItemInput[];
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Issue name is required');
  return trimmed;
}

function cleanRoutineName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Issue Routine name is required');
  return trimmed;
}

function validateReactionType(reactionType: string): asserts reactionType is IssueReactionType {
  if (reactionType !== 'aggravated' && reactionType !== 'helped') {
    throw new Error('Issue reaction must be aggravated or helped');
  }
}

function validateLinkType(linkType: string): asserts linkType is IssueExerciseLinkType {
  if (linkType !== 'helpful' && linkType !== 'aggravating') {
    throw new Error('Issue exercise link must be helpful or aggravating');
  }
}

function validateSeverity(severity: number | null | undefined): number | null {
  if (severity === undefined || severity === null) return null;
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    throw new Error('Issue severity must be an integer from 1 to 5');
  }
  return severity;
}

function validateRequiredSeverity(severity: number): number {
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    throw new Error('Issue severity must be an integer from 1 to 5');
  }
  return severity;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function validateRoutineItems(items: IssueRoutineItemInput[]): IssueRoutineItemInput[] {
  if (items.length === 0) throw new Error('Issue Routine requires at least one exercise');
  return items.map((item) => {
    if (!Number.isInteger(item.targetSets) || item.targetSets <= 0) {
      throw new Error('Issue Routine target sets must be a positive integer');
    }
    if (!Number.isInteger(item.targetReps) || item.targetReps <= 0) {
      throw new Error('Issue Routine target reps must be a positive integer');
    }
    return item;
  });
}

function toRoutineTemplateItems(items: IssueRoutineItemInput[]) {
  return validateRoutineItems(items).map((item) => ({
    exercise_id: item.exerciseId,
    target_sets: item.targetSets,
    target_reps: item.targetReps,
    target_weight: null,
    target_rpe: null,
    rest_seconds: null,
    note: cleanText(item.note),
    progression_rule: 'none' as const,
    increment_kg: null,
    increment_lb: null,
    rep_range_min: null,
    rep_range_max: null,
    rpe_cap: null,
    amrap_last_set: false,
  }));
}

export async function createIssue(db: SQLiteDatabase, input: CreateIssueInput): Promise<Issue> {
  const id = newId();
  const now = Date.now();
  const issue: Issue = {
    id,
    name: cleanName(input.name),
    note: cleanText(input.note),
    active: 1,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO issues (id, name, note, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [issue.id, issue.name, issue.note, issue.active, issue.created_at, issue.updated_at],
  );

  return issue;
}

export async function updateIssue(
  db: SQLiteDatabase,
  id: string,
  input: UpdateIssueInput,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    values.push(cleanName(input.name));
  }
  if (input.note !== undefined) {
    sets.push('note = ?');
    values.push(cleanText(input.note));
  }
  if (input.active !== undefined) {
    sets.push('active = ?');
    values.push(input.active ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  values.push(Date.now(), id);
  await db.runAsync(`UPDATE issues SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function archiveIssue(db: SQLiteDatabase, id: string): Promise<void> {
  await updateIssue(db, id, { active: false });
}

export async function createIssueCheckin(
  db: SQLiteDatabase,
  input: CreateIssueCheckinInput,
): Promise<IssueCheckin> {
  const issue = await getIssueById(db, input.issueId);
  if (!issue) throw new Error('Issue not found');

  const now = Date.now();
  const checkin: IssueCheckin = {
    id: newId(),
    issue_id: input.issueId,
    severity: validateRequiredSeverity(input.severity),
    note: cleanText(input.note),
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO issue_checkins
       (id, issue_id, severity, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      checkin.id,
      checkin.issue_id,
      checkin.severity,
      checkin.note,
      checkin.created_at,
      checkin.updated_at,
    ],
  );

  return checkin;
}

export async function getIssueRecentCheckins(
  db: SQLiteDatabase,
  issueId: string,
  limit = 10,
): Promise<IssueCheckin[]> {
  return db.getAllAsync<IssueCheckin>(
    `SELECT *
       FROM issue_checkins
      WHERE issue_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
    [issueId, limit],
  );
}

export async function getIssueCheckinTrend(
  db: SQLiteDatabase,
  issueId: string,
): Promise<IssueCheckinTrend> {
  const rows = await db.getAllAsync<Pick<IssueCheckin, 'severity'>>(
    `SELECT severity
       FROM issue_checkins
      WHERE issue_id = ?
      ORDER BY created_at ASC`,
    [issueId],
  );
  if (rows.length < 3) return { status: 'insufficient', count: rows.length };

  const firstThreeAverage = average(rows.slice(0, 3).map((row) => row.severity));
  const latestThreeAverage = average(rows.slice(-3).map((row) => row.severity));
  const diff = latestThreeAverage - firstThreeAverage;
  const status = diff <= -0.5 ? 'improving' : diff >= 0.5 ? 'worsening' : 'stable';

  return {
    status,
    count: rows.length,
    firstThreeAverage,
    latestThreeAverage,
  };
}

export async function getIssueRoutineCompletionContext(
  db: SQLiteDatabase,
  issueId: string,
  now = Date.now(),
): Promise<IssueRoutineCompletionContext | null> {
  const routine = await getIssueRoutine(db, issueId);
  if (!routine) return null;

  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const row = await db.getFirstAsync<{ completed_count: number }>(
    `SELECT COUNT(*) AS completed_count
       FROM workout_sessions
      WHERE template_id = ?
        AND status = 'completed'
        AND ended_at IS NOT NULL
        AND ended_at >= ?`,
    [routine.template_id, thirtyDaysAgo],
  );

  return {
    routineId: routine.id,
    templateId: routine.template_id,
    completedLast30Days: row?.completed_count ?? 0,
  };
}

export async function createIssueRoutine(
  db: SQLiteDatabase,
  input: CreateIssueRoutineInput,
): Promise<IssueRoutine> {
  const issue = await getIssueById(db, input.issueId);
  if (!issue) throw new Error('Issue not found');
  const existing = await getIssueRoutine(db, input.issueId);
  if (existing) throw new Error('Issue already has a linked routine');

  const now = Date.now();
  const routineId = newId();
  const template = await createTemplate(db, {
    name: cleanRoutineName(input.name),
    notes: null,
    items: toRoutineTemplateItems(input.items),
  });

  const routine: IssueRoutine = {
    id: routineId,
    issue_id: input.issueId,
    template_id: template.id,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO issue_routines (id, issue_id, template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [routine.id, routine.issue_id, routine.template_id, routine.created_at, routine.updated_at],
  );

  return routine;
}

export async function updateIssueRoutine(
  db: SQLiteDatabase,
  issueId: string,
  input: UpdateIssueRoutineInput,
): Promise<void> {
  const routine = await getIssueRoutine(db, issueId);
  if (!routine) throw new Error('Issue Routine not found');

  await updateTemplate(db, routine.template_id, {
    name: cleanRoutineName(input.name),
    notes: null,
    items: toRoutineTemplateItems(input.items),
  });

  await db.runAsync('UPDATE issue_routines SET updated_at = ? WHERE id = ?', [
    Date.now(),
    routine.id,
  ]);
}

export async function removeIssueRoutine(db: SQLiteDatabase, issueId: string): Promise<void> {
  const routine = await getIssueRoutine(db, issueId);
  if (!routine) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM issue_routines WHERE id = ?', [routine.id]);
    await archiveTemplate(db, routine.template_id);
  });
}

export async function getIssueRoutine(
  db: SQLiteDatabase,
  issueId: string,
): Promise<IssueRoutineSummary | null> {
  return db.getFirstAsync<IssueRoutineSummary>(
    `SELECT r.*, t.name AS routine_name, t.notes AS routine_note,
            COUNT(DISTINCT ti.id) AS exercise_count,
            MAX(CASE WHEN ws.status = 'completed' THEN ws.ended_at ELSE NULL END) AS last_completed_at
       FROM issue_routines r
       JOIN templates t ON t.id = r.template_id
       LEFT JOIN template_items ti ON ti.template_id = t.id
       LEFT JOIN workout_sessions ws ON ws.template_id = t.id
      WHERE r.issue_id = ?
      GROUP BY r.id`,
    [issueId],
  );
}

export async function getIssueRoutineItems(
  db: SQLiteDatabase,
  issueId: string,
): Promise<TemplateItemWithExercise[]> {
  const routine = await getIssueRoutine(db, issueId);
  if (!routine) return [];
  return getTemplateItemsWithExercise(db, routine.template_id);
}

export async function getIssues(
  db: SQLiteDatabase,
  includeArchived = true,
): Promise<IssueWithReactionCount[]> {
  const where = includeArchived ? '' : 'WHERE i.active = 1';
  return db.getAllAsync<IssueWithReactionCount>(
    `SELECT i.*, COUNT(e.id) AS reaction_count
       FROM issues i
       LEFT JOIN exercise_issue_events e ON e.issue_id = i.id
      ${where}
      GROUP BY i.id
      ORDER BY i.active DESC, i.updated_at DESC, i.name ASC`,
  );
}

export async function getActiveIssues(db: SQLiteDatabase): Promise<Issue[]> {
  return db.getAllAsync<Issue>(
    'SELECT * FROM issues WHERE active = 1 ORDER BY updated_at DESC, name ASC',
  );
}

export async function getIssueById(db: SQLiteDatabase, id: string): Promise<Issue | null> {
  return db.getFirstAsync<Issue>('SELECT * FROM issues WHERE id = ?', [id]);
}

export async function recordExerciseIssueEvent(
  db: SQLiteDatabase,
  input: RecordExerciseIssueEventInput,
): Promise<ExerciseIssueEvent> {
  validateReactionType(input.reactionType);
  const event: ExerciseIssueEvent = {
    id: newId(),
    issue_id: input.issueId,
    exercise_id: input.exerciseId,
    session_id: input.sessionId ?? null,
    reaction_type: input.reactionType,
    severity: validateSeverity(input.severity),
    note: cleanText(input.note),
    created_at: Date.now(),
  };

  await db.runAsync(
    `INSERT INTO exercise_issue_events
       (id, issue_id, exercise_id, session_id, reaction_type, severity, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.issue_id,
      event.exercise_id,
      event.session_id,
      event.reaction_type,
      event.severity,
      event.note,
      event.created_at,
    ],
  );

  return event;
}

export async function updateExerciseIssueEvent(
  db: SQLiteDatabase,
  id: string,
  input: UpdateExerciseIssueEventInput,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.reactionType !== undefined) {
    validateReactionType(input.reactionType);
    sets.push('reaction_type = ?');
    values.push(input.reactionType);
  }
  if (input.severity !== undefined) {
    sets.push('severity = ?');
    values.push(validateSeverity(input.severity));
  }
  if (input.note !== undefined) {
    sets.push('note = ?');
    values.push(cleanText(input.note));
  }
  if (sets.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE exercise_issue_events SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteExerciseIssueEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM exercise_issue_events WHERE id = ?', [id]);
}

export async function createIssueExerciseLink(
  db: SQLiteDatabase,
  input: CreateIssueExerciseLinkInput,
): Promise<IssueExerciseLink> {
  validateLinkType(input.linkType);
  const existing = await db.getFirstAsync<IssueExerciseLink>(
    `SELECT * FROM issue_exercise_links
      WHERE issue_id = ? AND exercise_id = ? AND link_type = ?`,
    [input.issueId, input.exerciseId, input.linkType],
  );
  if (existing) return existing;

  const now = Date.now();
  const link: IssueExerciseLink = {
    id: newId(),
    issue_id: input.issueId,
    exercise_id: input.exerciseId,
    link_type: input.linkType,
    note: cleanText(input.note),
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO issue_exercise_links
       (id, issue_id, exercise_id, link_type, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      link.id,
      link.issue_id,
      link.exercise_id,
      link.link_type,
      link.note,
      link.created_at,
      link.updated_at,
    ],
  );

  return link;
}

export async function updateIssueExerciseLink(
  db: SQLiteDatabase,
  id: string,
  input: UpdateIssueExerciseLinkInput,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.note !== undefined) {
    sets.push('note = ?');
    values.push(cleanText(input.note));
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  values.push(Date.now(), id);
  await db.runAsync(`UPDATE issue_exercise_links SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteIssueExerciseLink(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM issue_exercise_links WHERE id = ?', [id]);
}

export async function getIssueExerciseLinks(
  db: SQLiteDatabase,
  issueId: string,
): Promise<IssueExerciseLinkWithExerciseName[]> {
  return db.getAllAsync<IssueExerciseLinkWithExerciseName>(
    `SELECT l.*, ex.name AS exercise_name
       FROM issue_exercise_links l
       JOIN exercises ex ON ex.id = l.exercise_id
      WHERE l.issue_id = ?
      ORDER BY l.link_type DESC, ex.name ASC`,
    [issueId],
  );
}

export async function getActiveIssueExerciseLinksForExercise(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<IssueExerciseLinkWithIssueName[]> {
  return db.getAllAsync<IssueExerciseLinkWithIssueName>(
    `SELECT l.*, i.name AS issue_name
       FROM issue_exercise_links l
       JOIN issues i ON i.id = l.issue_id
      WHERE l.exercise_id = ?
        AND i.active = 1
      ORDER BY i.name ASC, l.link_type ASC`,
    [exerciseId],
  );
}

export async function getIssueRecentEvents(
  db: SQLiteDatabase,
  issueId: string,
  limit = 10,
): Promise<ExerciseIssueEventWithNames[]> {
  return db.getAllAsync<ExerciseIssueEventWithNames>(
    `SELECT e.*, i.name AS issue_name, ex.name AS exercise_name
       FROM exercise_issue_events e
       JOIN issues i ON i.id = e.issue_id
       JOIN exercises ex ON ex.id = e.exercise_id
      WHERE e.issue_id = ?
      ORDER BY e.created_at DESC
      LIMIT ?`,
    [issueId, limit],
  );
}

export async function getExerciseIssueEventsForExercise(
  db: SQLiteDatabase,
  exerciseId: string,
  limit = 50,
): Promise<ExerciseIssueEventWithIssueName[]> {
  return db.getAllAsync<ExerciseIssueEventWithIssueName>(
    `SELECT e.*, i.name AS issue_name
       FROM exercise_issue_events e
       JOIN issues i ON i.id = e.issue_id
      WHERE e.exercise_id = ?
      ORDER BY e.created_at DESC
      LIMIT ?`,
    [exerciseId, limit],
  );
}

export async function getExerciseIssueSummary(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<ExerciseIssueSummary[]> {
  const rows = await db.getAllAsync<{
    id: string;
    issue_id: string;
    issue_name: string;
    exercise_id: string;
    session_id: string | null;
    reaction_type: IssueReactionType;
    severity: number | null;
    note: string | null;
    created_at: number;
  }>(
    `SELECT e.id, e.issue_id, i.name AS issue_name, e.exercise_id, e.session_id,
            e.reaction_type, e.severity, e.note, e.created_at
       FROM exercise_issue_events e
       JOIN issues i ON i.id = e.issue_id
      WHERE e.exercise_id = ?
      ORDER BY e.created_at DESC`,
    [exerciseId],
  );

  const byIssue = new Map<string, ExerciseIssueSummary>();
  for (const row of rows) {
    let summary = byIssue.get(row.issue_id);
    if (!summary) {
      summary = {
        issueId: row.issue_id,
        issueName: row.issue_name,
        aggravatedCount: 0,
        helpedCount: 0,
        lastNote: null,
        lastCreatedAt: row.created_at,
        latestEvent: {
          id: row.id,
          issue_id: row.issue_id,
          exercise_id: row.exercise_id,
          session_id: row.session_id,
          reaction_type: row.reaction_type,
          severity: row.severity,
          note: row.note,
          created_at: row.created_at,
        },
      };
      byIssue.set(row.issue_id, summary);
    }
    if (row.reaction_type === 'aggravated') summary.aggravatedCount += 1;
    if (row.reaction_type === 'helped') summary.helpedCount += 1;
    if (summary.lastNote === null && row.note !== null) summary.lastNote = row.note;
  }

  return Array.from(byIssue.values()).sort((a, b) => b.lastCreatedAt - a.lastCreatedAt);
}
