import { calculateEstimated1RM } from './prs';
import {
  getProgressionSuggestion,
  type ProgressionExercise,
  type ProgressionRuleConfig,
  type ProgressionSet,
  type ProgressionSuggestion,
  type ProgressionTemplateTarget,
} from './progression';
import type { ProgressionRule, Unit } from './types';

export interface NextTimePreviewSet extends ProgressionSet {
  logged_at?: number;
  position?: number;
  deleted_at?: number | null;
}

export interface NextTimePreviewInput {
  exerciseId: string;
  exerciseName: string;
  exercise: ProgressionExercise;
  templateTarget: ProgressionTemplateTarget;
  progressionRule: ProgressionRuleConfig;
  recentSets: NextTimePreviewSet[];
  previousSessionSets?: NextTimePreviewSet[];
}

export interface NextTimePreview {
  exerciseId: string;
  exerciseName: string;
  bestSetLabel: string;
  status: string;
  nextTargetLabel: string;
  reason: string;
  rule: ProgressionRule;
  source: ProgressionSuggestion['source'];
  suggestion: ProgressionSuggestion;
}

function isCompletedWorkingSet(set: NextTimePreviewSet): boolean {
  return (
    (set.deleted_at ?? null) === null &&
    (set.set_type ?? 'working') !== 'warmup' &&
    (set.is_warmup ?? 0) === 0
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatRpe(rpe: number | null): string {
  return rpe !== null ? ` @ RPE ${formatNumber(rpe)}` : '';
}

function formatBestSet(set: NextTimePreviewSet | null, fallbackUnit: Unit): string {
  if (!set) return 'Logged set';

  const unit = set.unit ?? fallbackUnit;
  const rpe = formatRpe(set.rpe);

  if (set.weight !== null && set.reps !== null) {
    return `${formatNumber(set.weight)} ${unit} × ${set.reps}${rpe}`;
  }
  if (set.weight !== null) return `${formatNumber(set.weight)} ${unit}${rpe}`;
  if (set.reps !== null) return `${set.reps} reps${rpe}`;
  return `Logged set${rpe}`;
}

function formatTarget(suggestion: ProgressionSuggestion): string {
  const weight =
    suggestion.weight !== null ? `${formatNumber(suggestion.weight)} ${suggestion.unit}` : null;
  const reps = suggestion.isAmrap
    ? suggestion.amrapMinReps !== null && suggestion.amrapMinReps !== undefined
      ? `${suggestion.amrapMinReps}+ AMRAP`
      : 'AMRAP'
    : suggestion.reps !== null
      ? `${suggestion.reps}`
      : null;

  if (weight && reps) return `${weight} × ${reps}`;
  if (weight) return weight;
  if (reps) return `${reps} reps`;
  return 'No target yet';
}

function scoreSet(set: NextTimePreviewSet): number {
  if (set.weight !== null && set.reps !== null) {
    return calculateEstimated1RM(set.weight, set.reps) ?? set.weight;
  }
  if (set.weight !== null) return set.weight;
  if (set.reps !== null) return set.reps / 100;
  return 0;
}

function getBestSet(sets: NextTimePreviewSet[]): NextTimePreviewSet | null {
  const candidates = sets.filter(isCompletedWorkingSet);
  if (candidates.length === 0) return null;

  return candidates.reduce((best, set) => {
    const score = scoreSet(set);
    const bestScore = scoreSet(best);
    if (score !== bestScore) return score > bestScore ? set : best;

    const loggedAt = set.logged_at ?? 0;
    const bestLoggedAt = best.logged_at ?? 0;
    if (loggedAt !== bestLoggedAt) return loggedAt > bestLoggedAt ? set : best;

    return (set.position ?? 0) > (best.position ?? 0) ? set : best;
  });
}

export function buildNextTimePreview(input: NextTimePreviewInput): NextTimePreview | null {
  const recentSets = input.recentSets.filter((set) => (set.deleted_at ?? null) === null);
  if (recentSets.length === 0) return null;

  const suggestion = getProgressionSuggestion({
    exercise: input.exercise,
    templateTarget: input.templateTarget,
    progressionRule: input.progressionRule,
    recentSets,
    previousSessionSets: input.previousSessionSets ?? [],
  });

  return {
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    bestSetLabel: formatBestSet(getBestSet(recentSets), input.templateTarget.unit),
    status: input.progressionRule.rule === 'none' ? 'No progression rule' : suggestion.label,
    nextTargetLabel: formatTarget(suggestion),
    reason: suggestion.reason,
    rule: suggestion.rule,
    source: suggestion.source,
    suggestion,
  };
}
