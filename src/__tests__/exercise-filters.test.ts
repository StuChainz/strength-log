import { buildExerciseListFilters } from '@/domain/exerciseFilters';

describe('exercise list filters', () => {
  it('builds an empty repository filter for the default all view', () => {
    expect(buildExerciseListFilters('all', '')).toEqual({});
  });

  it('passes trimmed search through for repository-backed name and alias search', () => {
    expect(buildExerciseListFilters('all', '  bench  ')).toEqual({ query: 'bench' });
  });

  it('maps force chips to metadata force filters', () => {
    expect(buildExerciseListFilters('push', '')).toEqual({ force_type: 'push' });
  });

  it('maps category and custom chips to repository filters', () => {
    expect(buildExerciseListFilters('dumbbell', '')).toEqual({ category: 'dumbbell' });
    expect(buildExerciseListFilters('custom', '')).toEqual({ custom: true });
  });

  it('combines the active chip with search', () => {
    expect(buildExerciseListFilters('pull', 'row')).toEqual({
      force_type: 'pull',
      query: 'row',
    });
  });
});
