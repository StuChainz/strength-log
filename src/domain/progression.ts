import type {
  BodyRegion,
  ConfidenceLabel,
  ExerciseCategory,
  Mechanics,
  MovementPattern,
  ProgressionRule,
  IssueReactionType,
  SetType,
  Unit,
} from './types';

export interface ProgressionSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  set_type?: SetType;
  is_warmup?: 0 | 1;
}

export interface ProgressionExercise {
  category: ExerciseCategory;
  movementPattern?: MovementPattern | null;
  bodyRegion?: BodyRegion | null;
  mechanics?: Mechanics | null;
  equipment?: string[] | null;
}

export interface ProgressionTemplateTarget {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  unit: Unit;
  amrapLastSet?: boolean;
}

export interface ProgressionIssueReactionContext {
  issueName: string;
  reactionType: IssueReactionType;
  severity: number | null;
  createdAt: number;
  sessionId: string | null;
  setId: string | null;
}

export interface ProgressionRuleConfig {
  rule: ProgressionRule;
  incrementKg?: number | null;
  incrementLb?: number | null;
  repRangeMin?: number | null;
  repRangeMax?: number | null;
  rpeCap?: number | null;
  /**
   * Linear rule: number of consecutive sessions (recent + previous) that may
   * miss the rep target before the engine suggests a deload. Defaults to 2.
   * Set to null to disable deload entirely.
   */
  failureThreshold?: number | null;
  /** Multiplier applied to the last working weight when a deload is suggested. Defaults to 0.9. */
  deloadFactor?: number | null;
  /**
   * AMRAP threshold (in extra reps above `targetReps`). When the template has
   * `amrapLastSet` and the previous session's AMRAP set cleared this threshold,
   * the engine suggests a weight bump on the next session. Otherwise it
   * suggests repeating the target. Only consulted when `recentSets` is empty
   * (i.e. computing the first set of the next session).
   */
  amrapThresholdReps?: number | null;
}

export interface ProgressionInput {
  exercise: ProgressionExercise;
  templateTarget: ProgressionTemplateTarget;
  progressionRule: ProgressionRuleConfig;
  recentSets: ProgressionSet[];
  previousSessionSets?: ProgressionSet[];
  recentIssueReactions?: ProgressionIssueReactionContext[];
}

export interface ProgressionSuggestion {
  label: string;
  reason: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  source: 'template_rule' | 'fallback';
  rule: ProgressionRule;
  /**
   * True when the upcoming set is the AMRAP set of an `amrapLastSet` item.
   * Callers should render reps as "AMRAP" and treat `reps` (which will be
   * null) as no fixed target.
   */
  isAmrap?: boolean;
  /** Minimum reps for the AMRAP set (the template's targetReps, if set). */
  amrapMinReps?: number | null;
  /**
   * Confidence in the suggestion. `high` when the signal is clean (target
   * cleanly hit, or threshold cleanly met). `medium` for routine repeats.
   * `low` when there is insufficient history or the data is ambiguous.
   */
  confidence?: ConfidenceLabel;
  /**
   * True when the suggestion is a non-routine change the user should
   * consciously approve — e.g. a deload or an AMRAP-driven weight bump.
   * Tap-to-fill UI may surface this more prominently. The suggestion is
   * still never auto-applied.
   */
  requiresUserAction?: boolean;
  issueContext?: {
    issueName: string;
    reactionType: IssueReactionType;
    severity: number | null;
  };
  suppressedByIssue?: boolean;
}

function roundWeight(weight: number): number {
  return Math.max(0, parseFloat(weight.toFixed(2)));
}

function isNonWarmupSet(set: ProgressionSet): boolean {
  return set.is_warmup !== 1 && (set.set_type ?? 'working') !== 'warmup';
}

function workingSets(sets: ProgressionSet[], targetSets: number | null): ProgressionSet[] {
  const filtered = sets.filter(isNonWarmupSet);
  return targetSets !== null ? filtered.slice(0, targetSets) : filtered;
}

function lastWorkingSet(sets: ProgressionSet[]): ProgressionSet | null {
  const filtered = sets.filter(isNonWarmupSet);
  return filtered[filtered.length - 1] ?? null;
}

function hasEnoughSets(sets: ProgressionSet[], targetSets: number | null): boolean {
  return targetSets === null ? sets.length > 0 : sets.length >= targetSets;
}

function displayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function isUpperCompound(exercise: ProgressionExercise): boolean {
  return (
    exercise.mechanics === 'compound' &&
    [
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
    ].includes(exercise.movementPattern ?? '')
  );
}

function isLowerCompound(exercise: ProgressionExercise): boolean {
  return (
    exercise.mechanics === 'compound' &&
    (exercise.movementPattern === 'squat' ||
      exercise.movementPattern === 'hinge' ||
      exercise.bodyRegion === 'lower_body')
  );
}

function defaultIncrement(exercise: ProgressionExercise, unit: Unit): number {
  const equipment = exercise.equipment ?? [];
  const isDumbbell = exercise.category === 'dumbbell' || equipment.includes('dumbbell');

  if (unit === 'lb') {
    if (isDumbbell) return 2.5;
    if (isLowerCompound(exercise)) return 10;
    if (isUpperCompound(exercise)) return 5;
    if (exercise.category === 'barbell') return 5;
    return 5;
  }

  if (isDumbbell) return 1;
  if (isLowerCompound(exercise)) return 5;
  if (isUpperCompound(exercise)) return 2.5;
  if (exercise.category === 'barbell') return 2.5;
  return 2.5;
}

function incrementFor(input: ProgressionInput): number {
  const { progressionRule, templateTarget, exercise } = input;
  const override = templateTarget.unit === 'lb' ? progressionRule.incrementLb : progressionRule.incrementKg;
  return override ?? defaultIncrement(exercise, templateTarget.unit);
}

function targetWeightOrLast(
  target: ProgressionTemplateTarget,
  sets: ProgressionSet[],
): number | null {
  return target.targetWeight ?? lastWorkingSet(sets)?.weight ?? null;
}

function targetRepsOrLast(
  target: ProgressionTemplateTarget,
  sets: ProgressionSet[],
): number | null {
  return target.targetReps ?? lastWorkingSet(sets)?.reps ?? null;
}

function allSetsHitTarget(
  sets: ProgressionSet[],
  target: ProgressionTemplateTarget,
): boolean {
  const targetSets = workingSets(sets, target.targetSets);
  if (!hasEnoughSets(targetSets, target.targetSets)) return false;

  return targetSets.every((set) => {
    const repsHit = target.targetReps === null || (set.reps !== null && set.reps >= target.targetReps);
    const weightHit =
      target.targetWeight === null || (set.weight !== null && set.weight >= target.targetWeight);
    return repsHit && weightHit;
  });
}

function anySetMissedReps(
  sets: ProgressionSet[],
  target: ProgressionTemplateTarget,
): boolean {
  if (target.targetReps === null) return false;
  const targetSets = workingSets(sets, target.targetSets);
  if (!hasEnoughSets(targetSets, target.targetSets)) return targetSets.length > 0;
  return targetSets.some((set) => set.reps !== null && set.reps < target.targetReps!);
}

function maxRpe(sets: ProgressionSet[]): number | null {
  const values = workingSets(sets, null)
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => rpe !== null);
  return values.length > 0 ? Math.max(...values) : null;
}

function repeatTargetSuggestion(
  target: ProgressionTemplateTarget,
  sets: ProgressionSet[],
  rule: ProgressionRule,
  reason: string,
  label = 'Repeat target',
): ProgressionSuggestion {
  return {
    label,
    reason,
    weight: targetWeightOrLast(target, sets),
    reps: targetRepsOrLast(target, sets),
    rpe: null,
    unit: target.unit,
    source: rule === 'none' ? 'fallback' : 'template_rule',
    rule,
    confidence: 'medium',
    requiresUserAction: false,
  };
}

function mostRecentAggravatedIssue(
  reactions: ProgressionIssueReactionContext[] | undefined,
): ProgressionIssueReactionContext | null {
  if (!reactions || reactions.length === 0) return null;
  return (
    reactions
      .filter((reaction) => reaction.reactionType === 'aggravated')
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
  );
}

function issueSuppressionSuggestion(input: ProgressionInput): ProgressionSuggestion | null {
  const issue = mostRecentAggravatedIssue(input.recentIssueReactions);
  if (!issue) return null;

  const severity = issue.severity ?? 2;
  const highSeverity = severity >= 4;
  const reason =
    severity >= 4
      ? 'High issue aggravation noted recently: consider an easier set.'
      : severity >= 3
        ? 'Issue marked aggravated recently: repeat target.'
        : 'Issue noted recently: repeat target.';
  const suggestion = repeatTargetSuggestion(
    input.templateTarget,
    input.recentSets,
    input.progressionRule.rule,
    reason,
    highSeverity ? 'Consider an easier set' : 'Repeat target',
  );

  return {
    ...suggestion,
    reason,
    issueContext: {
      issueName: issue.issueName,
      reactionType: issue.reactionType,
      severity: issue.severity,
    },
    suppressedByIssue: true,
    requiresUserAction: severity >= 3,
  };
}

function deloadIfTriggered(input: ProgressionInput): ProgressionSuggestion | null {
  const { templateTarget, progressionRule, recentSets, previousSessionSets = [] } = input;
  const threshold = progressionRule.failureThreshold ?? 2;
  if (threshold === null || threshold <= 0) return null;

  const sessions: ProgressionSet[][] = [];
  if (recentSets.length > 0) sessions.push(recentSets);
  if (previousSessionSets.length > 0) sessions.push(previousSessionSets);
  if (sessions.length < threshold) return null;

  const missedCount = sessions
    .slice(0, threshold)
    .filter((sets) => anySetMissedReps(sets, templateTarget)).length;
  if (missedCount < threshold) return null;

  const baseWeight = targetWeightOrLast(templateTarget, recentSets) ?? targetWeightOrLast(templateTarget, previousSessionSets);
  if (baseWeight === null) return null;
  const factor = progressionRule.deloadFactor ?? 0.9;

  return {
    label: 'Linear: deload',
    reason: `Linear: deload after ${threshold} missed sessions`,
    weight: roundWeight(baseWeight * factor),
    reps: templateTarget.targetReps,
    rpe: null,
    unit: templateTarget.unit,
    source: 'template_rule',
    rule: 'linear',
    confidence: 'high',
    requiresUserAction: true,
  };
}

function amrapThresholdSuggestion(input: ProgressionInput): ProgressionSuggestion | null {
  const { templateTarget, progressionRule, recentSets, previousSessionSets = [] } = input;
  if (!templateTarget.amrapLastSet) return null;
  if (progressionRule.amrapThresholdReps == null) return null;
  if (recentSets.length > 0) return null;
  const lastAmrap = lastWorkingSet(previousSessionSets);
  if (!lastAmrap || lastAmrap.reps === null) return null;
  const minReps = templateTarget.targetReps ?? 0;
  const required = minReps + progressionRule.amrapThresholdReps;
  const baseWeight = lastAmrap.weight ?? templateTarget.targetWeight;
  if (baseWeight === null) return null;

  if (lastAmrap.reps >= required) {
    const increment = incrementFor(input);
    return {
      label: 'AMRAP: threshold cleared',
      reason: `AMRAP: ${lastAmrap.reps} reps cleared threshold of ${required}`,
      weight: roundWeight(baseWeight + increment),
      reps: templateTarget.targetReps,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: progressionRule.rule,
      confidence: 'high',
      requiresUserAction: true,
    };
  }

  return {
    label: 'AMRAP: hold target',
    reason: `AMRAP: ${lastAmrap.reps} reps under threshold of ${required}`,
    weight: roundWeight(baseWeight),
    reps: templateTarget.targetReps,
    rpe: null,
    unit: templateTarget.unit,
    source: 'template_rule',
    rule: progressionRule.rule,
    confidence: 'medium',
    requiresUserAction: false,
  };
}

function linearSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const { templateTarget, recentSets } = input;
  const lastSetRpe = lastWorkingSet(recentSets)?.rpe ?? null;
  const currentWeight = targetWeightOrLast(templateTarget, recentSets);
  const currentReps = targetRepsOrLast(templateTarget, recentSets);

  if (allSetsHitTarget(recentSets, templateTarget) && !(lastSetRpe !== null && lastSetRpe > 8.5)) {
    const increment = incrementFor(input);
    return {
      label: `Linear: target hit`,
      reason: `Linear: target hit`,
      weight: currentWeight !== null ? roundWeight(currentWeight + increment) : null,
      reps: currentReps,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'linear',
      confidence: 'high',
      requiresUserAction: false,
    };
  }

  const deload = deloadIfTriggered(input);
  if (deload) return deload;

  const reason = lastSetRpe !== null && lastSetRpe > 8.5 ? 'Linear: high effort' : 'Repeat target';
  return repeatTargetSuggestion(templateTarget, recentSets, 'linear', reason, reason);
}

function doubleSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const { templateTarget, progressionRule, recentSets } = input;
  const repMin = progressionRule.repRangeMin ?? templateTarget.targetReps ?? 1;
  const repMax = progressionRule.repRangeMax ?? Math.max(repMin, templateTarget.targetReps ?? repMin);
  const targetSets = workingSets(recentSets, templateTarget.targetSets);
  const currentWeight = targetWeightOrLast(templateTarget, recentSets);
  const highRpe = (maxRpe(targetSets) ?? 0) > 9;

  if (!hasEnoughSets(targetSets, templateTarget.targetSets)) {
    return {
      label: 'Double: build reps',
      reason: 'Double: build reps',
      weight: currentWeight,
      reps: repMin,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'double',
    };
  }

  const reps = targetSets
    .map((set) => set.reps)
    .filter((value): value is number => value !== null);
  const minCompleted = reps.length > 0 ? Math.min(...reps) : repMin;
  const allAtTop = targetSets.every((set) => set.reps !== null && set.reps >= repMax);

  if (highRpe) {
    return {
      label: 'Double: high effort',
      reason: 'Double: high effort',
      weight: currentWeight,
      reps: Math.min(repMax, Math.max(1, minCompleted)),
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'double',
    };
  }

  if (allAtTop) {
    const increment = incrementFor(input);
    return {
      label: 'Double: top of range hit',
      reason: 'Double: top of range hit',
      weight: currentWeight !== null ? roundWeight(currentWeight + increment) : null,
      reps: repMin,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'double',
    };
  }

  const nextReps =
    minCompleted < repMin ? Math.max(1, minCompleted) : Math.min(repMax, minCompleted + 1);
  return {
    label: 'Double: build reps',
    reason: 'Double: build reps',
    weight: currentWeight,
    reps: nextReps,
    rpe: null,
    unit: templateTarget.unit,
    source: 'template_rule',
    rule: 'double',
  };
}

function rpeGatedSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const { templateTarget, progressionRule, recentSets, previousSessionSets = [] } = input;
  const cap = progressionRule.rpeCap ?? 8.5;
  const currentWeight = targetWeightOrLast(templateTarget, recentSets);
  const currentReps = targetRepsOrLast(templateTarget, recentSets);
  const hitTarget = allSetsHitTarget(recentSets, templateTarget);
  const missedRecent = anySetMissedReps(recentSets, templateTarget);
  const missedPrevious = anySetMissedReps(previousSessionSets, templateTarget);
  const effort = maxRpe(workingSets(recentSets, templateTarget.targetSets));

  if (missedRecent && missedPrevious && currentWeight !== null) {
    return {
      label: 'RPE: reduce after misses',
      reason: 'RPE: missed twice',
      weight: roundWeight(currentWeight * 0.9),
      reps: currentReps,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'rpe_gated',
    };
  }

  if (effort !== null && effort > cap) {
    return repeatTargetSuggestion(templateTarget, recentSets, 'rpe_gated', 'RPE high: repeat target', 'RPE high: repeat target');
  }

  if (hitTarget && effort !== null && effort <= 7 && currentWeight !== null) {
    const increment = incrementFor(input);
    return {
      label: 'RPE easy: add weight',
      reason: 'RPE easy: add weight',
      weight: roundWeight(currentWeight + increment),
      reps: currentReps,
      rpe: null,
      unit: templateTarget.unit,
      source: 'template_rule',
      rule: 'rpe_gated',
    };
  }

  if (hitTarget && effort !== null && effort <= cap) {
    return repeatTargetSuggestion(templateTarget, recentSets, 'rpe_gated', 'RPE moderate: repeat target', 'RPE moderate: repeat target');
  }

  return repeatTargetSuggestion(templateTarget, recentSets, 'rpe_gated', 'Repeat target');
}

function missedTarget(set: ProgressionSet | null | undefined, targetReps: number | null): boolean {
  return targetReps !== null && set?.reps !== null && set?.reps !== undefined && set.reps < targetReps;
}

function hitTarget(set: ProgressionSet, targetReps: number | null): boolean {
  return targetReps === null || (set.reps !== null && set.reps >= targetReps);
}

function fallbackSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const { templateTarget, recentSets, previousSessionSets = [], exercise } = input;
  const lastSet = lastWorkingSet(recentSets);

  if (!lastSet) {
    return {
      label: 'No suggestion yet.',
      reason: 'No suggestion yet',
      weight: null,
      reps: null,
      rpe: null,
      unit: templateTarget.unit,
      source: 'fallback',
      rule: 'none',
    };
  }

  const previousSet = lastWorkingSet(previousSessionSets);
  const targetReps = templateTarget.targetReps;
  const missedLast = missedTarget(lastSet, targetReps);
  const missedPrevious = missedTarget(previousSet, targetReps);
  const reps = lastSet.reps ?? targetReps;
  const weight = lastSet.weight;
  const rpe = lastSet.rpe;

  if (missedLast && missedPrevious && weight !== null) {
    return {
      label: '-10% weight next time.',
      reason: 'Back off after missed reps',
      weight: roundWeight(weight * 0.9),
      reps,
      rpe: null,
      unit: lastSet.unit,
      source: 'fallback',
      rule: 'none',
    };
  }

  if ((rpe !== null && rpe > 8.5) || missedLast) {
    return {
      label: 'Same weight, one fewer rep.',
      reason: 'Back off after missed reps',
      weight,
      reps: reps !== null ? Math.max(1, reps - 1) : null,
      rpe: null,
      unit: lastSet.unit,
      source: 'fallback',
      rule: 'none',
    };
  }

  if (rpe !== null && rpe <= 7 && hitTarget(lastSet, targetReps) && weight !== null) {
    const increment = defaultIncrement(exercise, lastSet.unit);
    return {
      label: `Add ${displayNumber(increment)} ${lastSet.unit}.`,
      reason: 'Progress after easy set',
      weight: roundWeight(weight + increment),
      reps,
      rpe: null,
      unit: lastSet.unit,
      source: 'fallback',
      rule: 'none',
    };
  }

  return {
    label: 'Same weight, same reps.',
    reason: 'Repeat target',
    weight,
    reps,
    rpe: null,
    unit: lastSet.unit,
    source: 'fallback',
    rule: 'none',
  };
}

function isNextSetTheAmrapSet(input: ProgressionInput): boolean {
  const { templateTarget, recentSets } = input;
  if (!templateTarget.amrapLastSet) return false;
  if (templateTarget.targetSets === null || templateTarget.targetSets <= 0) return false;
  const workingCount = recentSets.filter(isNonWarmupSet).length;
  return workingCount === templateTarget.targetSets - 1;
}

function withAmrapOverride(
  input: ProgressionInput,
  suggestion: ProgressionSuggestion,
): ProgressionSuggestion {
  if (!isNextSetTheAmrapSet(input)) return suggestion;
  const minReps = input.templateTarget.targetReps;
  const minLabel = minReps !== null && minReps > 0 ? ` (min ${minReps}+)` : '';
  return {
    ...suggestion,
    reps: null,
    isAmrap: true,
    amrapMinReps: minReps,
    label: `AMRAP${minLabel}`,
    reason: suggestion.reason || 'AMRAP set',
  };
}

function inferConfidence(s: ProgressionSuggestion, input: ProgressionInput): ConfidenceLabel {
  if (s.confidence) return s.confidence;
  if (s.label === 'No suggestion yet.') return 'low';
  if (input.recentSets.length === 0 && (input.previousSessionSets?.length ?? 0) === 0) {
    return 'low';
  }
  return 'medium';
}

function withDefaults(s: ProgressionSuggestion, input: ProgressionInput): ProgressionSuggestion {
  return {
    ...s,
    confidence: inferConfidence(s, input),
    requiresUserAction: s.requiresUserAction ?? false,
  };
}

function plannedNextSetSuggestion(input: ProgressionInput): ProgressionSuggestion | null {
  const { templateTarget, progressionRule } = input;
  const isAmrap = isNextSetTheAmrapSet(input);
  const hasPlannedValue =
    templateTarget.targetWeight !== null || templateTarget.targetReps !== null || isAmrap;

  if (!hasPlannedValue) return null;

  return withDefaults(
    {
      label: isAmrap ? 'AMRAP' : 'Planned target',
      reason: isAmrap ? 'Planned AMRAP set' : 'Planned target',
      weight: templateTarget.targetWeight,
      reps: isAmrap ? null : templateTarget.targetReps,
      rpe: null,
      unit: templateTarget.unit,
      source: progressionRule.rule === 'none' ? 'fallback' : 'template_rule',
      rule: progressionRule.rule,
      isAmrap,
      amrapMinReps: isAmrap ? templateTarget.targetReps : undefined,
      confidence: 'high',
      requiresUserAction: false,
    },
    input,
  );
}

function repeatLatestLoggedSetSuggestion(input: ProgressionInput): ProgressionSuggestion | null {
  const lastSet = lastWorkingSet(input.recentSets);
  if (!lastSet || (lastSet.weight === null && lastSet.reps === null)) return null;

  let label = 'Repeat logged set';
  let reason = 'Repeat logged set';
  let confidence: ConfidenceLabel = 'medium';

  if (input.progressionRule.rule === 'rpe_gated' && lastSet.rpe !== null) {
    const cap = input.progressionRule.rpeCap ?? 8.5;
    if (lastSet.rpe > cap) {
      label = 'RPE cap: repeat logged set';
      reason = `RPE ${displayNumber(lastSet.rpe)} exceeds cap ${displayNumber(cap)}: repeat logged set`;
      confidence = 'high';
    } else {
      label = 'RPE under cap: repeat logged set';
      reason = `RPE ${displayNumber(lastSet.rpe)} at or under cap ${displayNumber(cap)}: repeat logged set`;
    }
  }

  return withDefaults(
    {
      label,
      reason,
      weight: lastSet.weight,
      reps: lastSet.reps,
      rpe: null,
      unit: lastSet.unit,
      source: input.progressionRule.rule === 'none' ? 'fallback' : 'template_rule',
      rule: input.progressionRule.rule,
      confidence,
      requiresUserAction: false,
    },
    input,
  );
}

export function getLiveWorkoutSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const issueGate = issueSuppressionSuggestion(input);
  if (issueGate) return withDefaults(withAmrapOverride(input, issueGate), input);

  const latestLogged = repeatLatestLoggedSetSuggestion(input);
  if (latestLogged) return latestLogged;

  const planned = plannedNextSetSuggestion(input);
  if (planned) return planned;

  return getProgressionSuggestion(input);
}

export function getProgressionSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const issueGate = issueSuppressionSuggestion(input);
  if (issueGate) return withDefaults(withAmrapOverride(input, issueGate), input);

  const amrapGate = amrapThresholdSuggestion(input);
  if (amrapGate) return withDefaults(withAmrapOverride(input, amrapGate), input);

  let base: ProgressionSuggestion;
  switch (input.progressionRule.rule) {
    case 'linear':
      base = linearSuggestion(input);
      break;
    case 'double':
      base = doubleSuggestion(input);
      break;
    case 'rpe_gated':
      base = rpeGatedSuggestion(input);
      break;
    case 'none':
    default:
      base = fallbackSuggestion(input);
      break;
  }
  return withDefaults(withAmrapOverride(input, base), input);
}
