import React from 'react';
import { render } from '@testing-library/react-native';
import MusclesWorkedSection, {
  BODY_MAP_REGIONS,
  getMuscleHighlightOpacity,
  getMuscleRanking,
} from '@/components/MusclesWorkedSection';
import { calculateSessionMuscleSummary } from '@/domain/sessionMuscles';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
import { T } from '@/theme/tokens';

describe('MusclesWorkedSection', () => {
  function expectHighlightedRegion(muscle: MuscleGroup, side: 'front' | 'back' = 'front') {
    const { getAllByTestId } = render(<MusclesWorkedSection muscleSummary={{ [muscle]: 3 }} />);
    const regions = getAllByTestId(`body-map-region-${side}-${muscle}`);

    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((region) => region.props.fill === T.accent)).toBe(true);
    expect(regions.some((region) => region.props.fillOpacity > 0.18)).toBe(true);
  }

  it('renders a front and back body map with session data', () => {
    const { getByTestId, getByText } = render(
      <MusclesWorkedSection muscleSummary={{ chest: 8, triceps: 5, front_delts: 4 }} />,
    );

    expect(getByText('Muscles Worked')).toBeTruthy();
    expect(getByTestId('body-map-front')).toBeTruthy();
    expect(getByTestId('body-map-back')).toBeTruthy();
    expect(getByTestId('body-map-region-front-chest').props.fill).toBe(T.accent);
    expect(getByText('Chest')).toBeTruthy();
    expect(getByText('8')).toBeTruthy();
  });

  it('renders an empty session safely', () => {
    const { getByText, queryByTestId } = render(<MusclesWorkedSection muscleSummary={{}} />);

    expect(getByText('No muscle data')).toBeTruthy();
    expect(queryByTestId('muscle-rank-chest')).toBeNull();
  });

  it('highlights side delt regions when side delts are scored', () => {
    expectHighlightedRegion('side_delts');
  });

  it('highlights forearm regions when forearms are scored', () => {
    expectHighlightedRegion('forearms');
  });

  it('highlights oblique regions when obliques are scored', () => {
    expectHighlightedRegion('obliques');
  });

  it('still highlights existing chest, back, and leg regions', () => {
    expectHighlightedRegion('chest');
    expectHighlightedRegion('upper_back', 'back');
    expectHighlightedRegion('quads');
  });

  it('ranks muscles from the session muscle calculation service', () => {
    const muscleSummary = calculateSessionMuscleSummary(
      { status: 'completed' },
      [
        { exercise_id: 'bench' },
        { exercise_id: 'bench' },
        { exercise_id: 'bench' },
        { exercise_id: 'row' },
        { exercise_id: 'row' },
      ],
      [
        {
          exercise_id: 'bench',
          primary_muscles: ['chest'],
          secondary_muscles: ['front_delts', 'triceps'],
        },
        {
          exercise_id: 'row',
          primary_muscles: ['upper_back'],
          secondary_muscles: ['biceps'],
        },
      ],
    );

    expect(getMuscleRanking(muscleSummary)).toEqual([
      { muscle: 'chest', label: 'Chest', score: 3 },
      { muscle: 'upper_back', label: 'Upper Back', score: 2 },
      { muscle: 'front_delts', label: 'Front Delts', score: 1.5 },
      { muscle: 'triceps', label: 'Triceps', score: 1.5 },
      { muscle: 'biceps', label: 'Biceps', score: 1 },
    ]);
  });

  it('includes every scored muscle in ranking rows', () => {
    const muscleSummary = Object.fromEntries(
      MUSCLE_GROUPS.map((muscle, index) => [muscle, index + 1]),
    ) as Record<MuscleGroup, number>;

    const rankedMuscles = getMuscleRanking(muscleSummary).map((row) => row.muscle);

    expect(rankedMuscles).toHaveLength(MUSCLE_GROUPS.length);
    for (const muscle of MUSCLE_GROUPS) {
      expect(rankedMuscles).toContain(muscle);
    }
  });

  it('maps supported regions and scales highlight strength deterministically', () => {
    expect(BODY_MAP_REGIONS.front).toEqual([
      'chest',
      'front_delts',
      'side_delts',
      'biceps',
      'forearms',
      'abs',
      'obliques',
      'quads',
      'adductors',
      'calves',
    ]);
    expect(BODY_MAP_REGIONS.back).toEqual([
      'upper_back',
      'lats',
      'rear_delts',
      'side_delts',
      'traps',
      'triceps',
      'forearms',
      'obliques',
      'spinal_erectors',
      'glutes',
      'hamstrings',
      'calves',
    ]);

    const summary = { chest: 8, triceps: 4 };
    expect(getMuscleHighlightOpacity(summary, 'chest')).toBeGreaterThan(
      getMuscleHighlightOpacity(summary, 'triceps'),
    );
    expect(getMuscleHighlightOpacity(summary, 'abs')).toBe(0.18);
  });
});
