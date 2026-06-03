import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/domain/ids';
import type { ExerciseIssueEvent, Issue, IssueReactionType } from '@/domain/types';

export interface IssueWithReactionCount extends Issue {
  reaction_count: number;
}

export interface ExerciseIssueEventWithNames extends ExerciseIssueEvent {
  issue_name: string;
  exercise_name: string;
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

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Issue name is required');
  return trimmed;
}

function validateReactionType(reactionType: string): asserts reactionType is IssueReactionType {
  if (reactionType !== 'aggravated' && reactionType !== 'helped') {
    throw new Error('Issue reaction must be aggravated or helped');
  }
}

function validateSeverity(severity: number | null | undefined): number | null {
  if (severity === undefined || severity === null) return null;
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    throw new Error('Issue severity must be an integer from 1 to 5');
  }
  return severity;
}

export async function createIssue(
  db: SQLiteDatabase,
  input: CreateIssueInput,
): Promise<Issue> {
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

export async function getIssueById(
  db: SQLiteDatabase,
  id: string,
): Promise<Issue | null> {
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

export async function deleteExerciseIssueEvent(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM exercise_issue_events WHERE id = ?', [id]);
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
