import { getProgressionSuggestion, type ProgressionInput } from '@/domain/progression';

const baseTarget = {
  targetSets: 3,
  targetReps: 5,
  targetWeight: 80,
  unit: 'kg' as const,
};

const baseSet = {
  weight: 80,
  reps: 5,
  rpe: 8,
  unit: 'kg' as const,
  set_type: 'working' as const,
};

function suggestion(input: Partial<ProgressionInput>) {
  return getProgressionSuggestion({
    exercise: {
      category: 'barbell',
      movementPattern: 'horizontal_push',
      bodyRegion: 'upper_body',
      mechanics: 'compound',
      equipment: ['barbell'],
    },
    templateTarget: baseTarget,
    progressionRule: { rule: 'none' },
    recentSets: [],
    previousSessionSets: [],
    ...input,
  });
}

describe('getProgressionSuggestion', () => {
  it('linear rule adds 2.5kg for upper body compounds when target hit', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 82.5,
        reps: 5,
        source: 'template_rule',
        rule: 'linear',
      }),
    );
  });

  it('linear rule adds 5kg for squat/deadlift/hinge lower compounds when target hit', () => {
    const next = suggestion({
      exercise: {
        category: 'barbell',
        movementPattern: 'hinge',
        bodyRegion: 'lower_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, baseSet, baseSet],
    });

    expect(next.weight).toBe(85);
  });

  it('linear rule repeats target when target missed', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
    });

    expect(next).toEqual(expect.objectContaining({ weight: 80, reps: 5, reason: 'Repeat target' }));
  });

  it('linear rule repeats target when last set RPE is over 8.5', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, baseSet, { ...baseSet, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'Linear: high effort' }),
    );
  });

  it('double progression builds reps within range', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 10 },
        { ...baseSet, weight: 20, reps: 9 },
        { ...baseSet, weight: 20, reps: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 20, reps: 9, reason: 'Double: build reps' }),
    );
  });

  it('double progression builds reps from previous 3x8 when current sets are empty', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: 3,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [],
      previousSessionSets: [
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 40, reps: 9, reason: 'Double: build reps' }),
    );
  });

  it('double progression builds reps from previous 3x9 when current sets are empty', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: 3,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [],
      previousSessionSets: [
        { ...baseSet, weight: 40, reps: 9 },
        { ...baseSet, weight: 40, reps: 9 },
        { ...baseSet, weight: 40, reps: 9 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 40, reps: 10, reason: 'Double: build reps' }),
    );
  });

  it('double progression adds weight and resets reps from previous 3x12 when current sets are empty', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: 3,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [],
      previousSessionSets: [
        { ...baseSet, weight: 40, reps: 12 },
        { ...baseSet, weight: 40, reps: 12 },
        { ...baseSet, weight: 40, reps: 12 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 42.5, reps: 8, reason: 'Double: top of range hit' }),
    );
  });

  it('double progression does not build past the lowest previous target working set', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: 3,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [],
      previousSessionSets: [
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 7 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 40, reps: 7, reason: 'Double: build reps' }),
    );
    expect(next.reps).not.toBe(9);
  });

  it('double progression ignores warm-up sets when building from previous sessions', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: 3,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [],
      previousSessionSets: [
        { ...baseSet, weight: 20, reps: 12, set_type: 'warmup' },
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 8 },
        { ...baseSet, weight: 40, reps: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 40, reps: 9, reason: 'Double: build reps' }),
    );
  });

  it('double progression adds weight and resets reps after all sets hit rep range max', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 12 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 22.5, reps: 8, reason: 'Double: top of range hit' }),
    );
  });

  it('double progression does not exceed rep range max', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 11 },
        { ...baseSet, weight: 20, reps: 12 },
      ],
    });

    expect(next.reps).toBe(12);
  });

  it('double progression handles poor performance safely', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 7 },
        { ...baseSet, weight: 20, reps: 6 },
        { ...baseSet, weight: 20, reps: 5 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 20, reps: 5, reason: 'Double: build reps' }),
    );
  });

  it('RPE-gated progresses when easy', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [
        { ...baseSet, rpe: 7 },
        { ...baseSet, rpe: 7 },
        { ...baseSet, rpe: 7 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 82.5, reps: 5, reason: 'RPE easy: add weight' }),
    );
  });

  it('RPE-gated repeats when moderate', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'RPE moderate: repeat target' }),
    );
  });

  it('RPE-gated repeats when RPE is high', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated', rpeCap: 8.5 },
      recentSets: [baseSet, baseSet, { ...baseSet, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'RPE high: repeat target' }),
    );
  });

  it('RPE-gated reduces weight after two missed targets', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
      previousSessionSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 72, reps: 5, reason: 'RPE: missed twice' }),
    );
  });

  it('none rule falls back to the existing conservative suggestion', () => {
    const next = suggestion({
      progressionRule: { rule: 'none' },
      recentSets: [{ ...baseSet, reps: 5, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 80,
        reps: 4,
        source: 'fallback',
        rule: 'none',
      }),
    );
  });

  it('none rule uses a previous-session set for the first set when no template target exists', () => {
    const next = suggestion({
      templateTarget: {
        targetSets: null,
        targetReps: null,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'none' },
      recentSets: [],
      previousSessionSets: [{ ...baseSet, weight: 37.5, reps: 5, rpe: null }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 37.5,
        reps: 5,
        source: 'fallback',
        rule: 'none',
      }),
    );
  });

  it('suggestions never auto-apply in domain logic', () => {
    const set = { ...baseSet };
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [set, set, set],
    });

    expect(set).toEqual(baseSet);
    expect(next).not.toHaveProperty('apply');
  });

  describe('issue reaction gate', () => {
    const hitTargetSets = [baseSet, baseSet, baseSet];

    it.each([1, 2, null] as const)(
      'suppresses weight increase and repeats target for aggravated severity %s',
      (severity) => {
        const next = suggestion({
          progressionRule: { rule: 'linear' },
          recentSets: hitTargetSets,
          recentIssueReactions: [
            {
              issueId: 'issue-shoulder',
              issueName: 'Shoulder',
              reactionType: 'aggravated',
              severity,
              createdAt: 2_000,
              sessionId: 'session-1',
              setId: null,
            },
          ],
        });

        expect(next).toEqual(
          expect.objectContaining({
            weight: 80,
            reps: 5,
            reason: 'Recent issue note: repeat target.',
            suppressedByIssue: true,
            requiresUserAction: false,
          }),
        );
      },
    );

    it('suppresses progression and requires user action for aggravated severity 3', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        recentSets: hitTargetSets,
        recentIssueReactions: [
          {
            issueId: 'issue-shoulder',
            issueName: 'Shoulder',
            reactionType: 'aggravated',
            severity: 3,
            createdAt: 2_000,
            sessionId: 'session-1',
            setId: null,
          },
        ],
      });

      expect(next).toEqual(
        expect.objectContaining({
          weight: 80,
          reps: 5,
          reason: 'Recent issue note: repeat target.',
          suppressedByIssue: true,
          requiresUserAction: true,
        }),
      );
    });

    it.each([4, 5] as const)(
      'uses cautious easier-set wording and requires user action for aggravated severity %s',
      (severity) => {
        const next = suggestion({
          progressionRule: { rule: 'linear' },
          recentSets: hitTargetSets,
          recentIssueReactions: [
            {
              issueId: 'issue-shoulder',
              issueName: 'Shoulder',
              reactionType: 'aggravated',
              severity,
              createdAt: 2_000,
              sessionId: 'session-1',
              setId: null,
            },
          ],
        });

        expect(next).toEqual(
          expect.objectContaining({
            weight: 80,
            reps: 5,
            reason: 'Recent high issue note: consider an easier set.',
            suppressedByIssue: true,
            requiresUserAction: true,
          }),
        );
      },
    );

    it('uses the most recent aggravated reaction for the current exercise', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        recentSets: hitTargetSets,
        recentIssueReactions: [
          {
            issueId: 'issue-older',
            issueName: 'Older issue',
            reactionType: 'aggravated',
            severity: 4,
            createdAt: 1_000,
            sessionId: 'session-1',
            setId: null,
          },
          {
            issueId: 'issue-newer',
            issueName: 'Newer issue',
            reactionType: 'aggravated',
            severity: 2,
            createdAt: 2_000,
            sessionId: 'session-2',
            setId: null,
          },
        ],
      });

      expect(next.reason).toBe('Recent issue note: repeat target.');
      expect(next.issueContext).toEqual({
        issueId: 'issue-newer',
        issueName: 'Newer issue',
        reactionType: 'aggravated',
        severity: 2,
      });
    });

    it('does not suppress normal progression for helped reactions', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        recentSets: hitTargetSets,
        recentIssueReactions: [
          {
            issueId: 'issue-shoulder',
            issueName: 'Shoulder',
            reactionType: 'helped',
            severity: 5,
            createdAt: 2_000,
            sessionId: 'session-1',
            setId: null,
          },
        ],
      });

      expect(next).toEqual(
        expect.objectContaining({
          weight: 82.5,
          reps: 5,
          reason: 'Linear: target hit',
        }),
      );
      expect(next.suppressedByIssue).toBeUndefined();
    });

    it('preserves existing progression behavior without issue context', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        recentSets: hitTargetSets,
      });

      expect(next).toEqual(
        expect.objectContaining({
          weight: 82.5,
          reps: 5,
          reason: 'Linear: target hit',
          requiresUserAction: false,
        }),
      );
    });
  });

  describe('linear deload', () => {
    it('suggests deload after the configured failure threshold of missed sessions', () => {
      const missed = { ...baseSet, reps: 3 };
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 2 },
        recentSets: [missed, missed, missed],
        previousSessionSets: [missed, missed, missed],
      });

      expect(next.weight).toBe(72);
      expect(next.reps).toBe(5);
      expect(next.reason).toMatch(/deload/i);
      expect(next.confidence).toBe('high');
      expect(next.requiresUserAction).toBe(true);
    });

    it('does not deload before reaching the threshold', () => {
      const missed = { ...baseSet, reps: 3 };
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 3 },
        recentSets: [missed, missed, missed],
        previousSessionSets: [missed, missed, missed],
      });

      expect(next.weight).toBe(80);
      expect(next.reason).not.toMatch(/deload/i);
      expect(next.requiresUserAction).toBe(false);
    });

    it('does not deload when target was hit even with a non-null threshold', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 2 },
        recentSets: [baseSet, baseSet, baseSet],
        previousSessionSets: [baseSet, baseSet, baseSet],
      });

      expect(next.weight).toBe(82.5);
      expect(next.requiresUserAction).toBe(false);
    });

    it('respects a custom deloadFactor', () => {
      const missed = { ...baseSet, reps: 3 };
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 2, deloadFactor: 0.85 },
        recentSets: [missed, missed, missed],
        previousSessionSets: [missed, missed, missed],
      });

      expect(next.weight).toBe(68);
    });

    it('missed reps never increase load', () => {
      const missed = { ...baseSet, reps: 4 };
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 2 },
        recentSets: [missed, missed, missed],
      });

      expect(next.weight).toBeLessThanOrEqual(80);
    });
  });

  describe('amrap threshold', () => {
    const amrapTarget = {
      targetSets: 3,
      targetReps: 5,
      targetWeight: 80,
      unit: 'kg' as const,
      amrapLastSet: true,
    };

    it('suggests a weight bump when the previous AMRAP set cleared the threshold', () => {
      const next = suggestion({
        templateTarget: amrapTarget,
        progressionRule: { rule: 'linear', amrapThresholdReps: 3 },
        recentSets: [],
        previousSessionSets: [
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 9 },
        ],
      });

      expect(next.weight).toBe(82.5);
      expect(next.reason).toMatch(/AMRAP/);
      expect(next.confidence).toBe('high');
      expect(next.requiresUserAction).toBe(true);
    });

    it('repeats target when the previous AMRAP set fell short of the threshold', () => {
      const next = suggestion({
        templateTarget: amrapTarget,
        progressionRule: { rule: 'linear', amrapThresholdReps: 5 },
        recentSets: [],
        previousSessionSets: [
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 6 },
        ],
      });

      expect(next.weight).toBe(80);
      expect(next.reps).toBe(5);
      expect(next.requiresUserAction).toBe(false);
    });

    it('does not bump weight when amrapLastSet flag is off, even if reps cleared', () => {
      const next = suggestion({
        templateTarget: { ...amrapTarget, amrapLastSet: false },
        progressionRule: { rule: 'linear', amrapThresholdReps: 1 },
        recentSets: [],
        previousSessionSets: [
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 12 },
        ],
      });

      expect(next.reason).not.toMatch(/AMRAP/);
    });
  });

  describe('suggestion metadata', () => {
    it('always includes confidence and requiresUserAction', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        recentSets: [baseSet, baseSet, baseSet],
      });

      expect(['low', 'medium', 'high']).toContain(next.confidence);
      expect(typeof next.requiresUserAction).toBe('boolean');
    });

    it('marks suggestion as low confidence when no history is available', () => {
      const next = suggestion({
        progressionRule: { rule: 'none' },
        recentSets: [],
        previousSessionSets: [],
      });

      expect(next.confidence).toBe('low');
    });

    it('never auto-applies — pure return, no side effects', () => {
      const initial = [
        { ...baseSet },
        { ...baseSet },
        { ...baseSet },
      ];
      const snapshot = JSON.parse(JSON.stringify(initial));
      const next = suggestion({
        progressionRule: { rule: 'linear', failureThreshold: 2 },
        recentSets: initial,
        previousSessionSets: initial,
      });

      expect(initial).toEqual(snapshot);
      expect(next).not.toHaveProperty('apply');
    });
  });

  describe('amrap last set', () => {
    it('marks the final working set as AMRAP and clears the rep suggestion', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        templateTarget: { ...baseTarget, targetSets: 5, targetReps: 3, amrapLastSet: true },
        recentSets: [
          { ...baseSet, reps: 3 },
          { ...baseSet, reps: 3 },
          { ...baseSet, reps: 3 },
          { ...baseSet, reps: 3 },
        ],
      });

      expect(next.isAmrap).toBe(true);
      expect(next.reps).toBeNull();
      expect(next.amrapMinReps).toBe(3);
      expect(next.label).toContain('AMRAP');
      expect(next.weight).toBe(80);
    });

    it('does not mark earlier sets as AMRAP', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        templateTarget: { ...baseTarget, targetSets: 5, targetReps: 3, amrapLastSet: true },
        recentSets: [
          { ...baseSet, reps: 3 },
          { ...baseSet, reps: 3 },
        ],
      });

      expect(next.isAmrap).toBeFalsy();
      expect(next.reps).toBe(3);
    });

    it('marks the first/only set as AMRAP when targetSets is 1', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        templateTarget: { ...baseTarget, targetSets: 1, targetReps: 5, amrapLastSet: true },
        recentSets: [],
      });

      expect(next.isAmrap).toBe(true);
      expect(next.reps).toBeNull();
      expect(next.amrapMinReps).toBe(5);
    });

    it('ignores AMRAP flag when targetSets is null', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        templateTarget: { ...baseTarget, targetSets: null, amrapLastSet: true },
        recentSets: [],
      });

      expect(next.isAmrap).toBeFalsy();
    });

    it('does not affect non-AMRAP items', () => {
      const next = suggestion({
        progressionRule: { rule: 'linear' },
        templateTarget: { ...baseTarget, targetSets: 3, targetReps: 5 },
        recentSets: [
          { ...baseSet, reps: 5 },
          { ...baseSet, reps: 5 },
        ],
      });

      expect(next.isAmrap).toBeFalsy();
      expect(next.reps).toBe(5);
    });
  });
});
