import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
import { MUSCLE_LABELS } from '@/domain/muscleLabels';
import type { SessionMuscleSummary } from '@/domain/sessionMuscles';
import { T } from '@/theme/tokens';

type BodyMapSide = 'front' | 'back';

type RegionShape = {
  muscle: MuscleGroup;
  d: string;
};

export type MuscleRankingRow = {
  muscle: MuscleGroup;
  label: string;
  score: number;
};

export const BODY_MAP_REGIONS: Record<BodyMapSide, MuscleGroup[]> = {
  front: [
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
  ],
  back: [
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
  ],
};

const FRONT_REGION_SHAPES: RegionShape[] = [
  { muscle: 'chest', d: 'M55 57 C65 51 82 51 91 57 L87 80 L60 80 Z' },
  { muscle: 'front_delts', d: 'M41 61 C47 54 55 55 59 62 L52 78 C47 77 42 72 41 61 Z' },
  { muscle: 'front_delts', d: 'M91 62 C95 55 103 54 109 61 C108 72 103 77 98 78 Z' },
  { muscle: 'side_delts', d: 'M36 65 C39 59 43 57 47 60 L43 76 C39 76 36 72 36 65 Z' },
  { muscle: 'side_delts', d: 'M104 60 C108 57 112 59 115 65 C115 72 112 76 108 76 Z' },
  { muscle: 'biceps', d: 'M31 79 C39 75 45 78 46 86 L42 116 C39 123 32 121 30 113 Z' },
  {
    muscle: 'biceps',
    d: 'M114 79 L115 113 C113 121 106 123 103 116 L99 86 C100 78 106 75 114 79 Z',
  },
  { muscle: 'forearms', d: 'M30 116 C35 121 41 121 43 116 L49 138 C47 145 40 146 36 139 Z' },
  { muscle: 'forearms', d: 'M103 116 C105 121 111 121 116 116 L110 139 C106 146 99 145 97 138 Z' },
  { muscle: 'abs', d: 'M61 82 L86 82 L89 123 C82 127 67 127 58 123 Z' },
  { muscle: 'obliques', d: 'M55 83 L61 84 L58 122 L53 126 L50 102 Z' },
  { muscle: 'obliques', d: 'M86 84 L92 83 L97 102 L94 126 L89 122 Z' },
  { muscle: 'quads', d: 'M55 130 C63 128 70 130 72 138 L70 187 C62 189 54 185 52 177 Z' },
  { muscle: 'quads', d: 'M78 138 C80 130 87 128 95 130 L98 177 C96 185 88 189 80 187 Z' },
  { muscle: 'adductors', d: 'M69 131 L75 131 L74 183 L70 183 Z' },
  { muscle: 'calves', d: 'M52 190 C60 187 68 190 69 199 L67 233 L55 233 Z' },
  { muscle: 'calves', d: 'M81 199 C82 190 90 187 98 190 L95 233 L83 233 Z' },
];

const BACK_REGION_SHAPES: RegionShape[] = [
  { muscle: 'traps', d: 'M61 48 C70 55 80 55 89 48 L95 65 L55 65 Z' },
  { muscle: 'upper_back', d: 'M56 66 L94 66 L88 92 L62 92 Z' },
  { muscle: 'rear_delts', d: 'M42 61 C48 54 56 55 60 63 L53 79 C48 78 43 72 42 61 Z' },
  { muscle: 'rear_delts', d: 'M90 63 C94 55 102 54 108 61 C107 72 102 78 97 79 Z' },
  { muscle: 'side_delts', d: 'M36 65 C39 59 43 57 47 60 L43 76 C39 76 36 72 36 65 Z' },
  { muscle: 'side_delts', d: 'M104 60 C108 57 112 59 115 65 C115 72 112 76 108 76 Z' },
  { muscle: 'lats', d: 'M55 72 L64 94 L61 122 C52 115 47 96 48 78 Z' },
  { muscle: 'lats', d: 'M95 72 L102 78 C103 96 98 115 89 122 L86 94 Z' },
  { muscle: 'triceps', d: 'M31 80 C39 76 45 78 46 86 L42 118 C38 124 32 121 30 113 Z' },
  {
    muscle: 'triceps',
    d: 'M114 80 L115 113 C113 121 107 124 103 118 L99 86 C100 78 106 76 114 80 Z',
  },
  { muscle: 'forearms', d: 'M30 116 C35 121 41 121 43 116 L49 138 C47 145 40 146 36 139 Z' },
  { muscle: 'forearms', d: 'M103 116 C105 121 111 121 116 116 L110 139 C106 146 99 145 97 138 Z' },
  { muscle: 'obliques', d: 'M56 92 L62 94 L60 124 L54 128 L50 104 Z' },
  { muscle: 'obliques', d: 'M88 94 L94 92 L100 104 L96 128 L90 124 Z' },
  { muscle: 'spinal_erectors', d: 'M69 94 L74 94 L74 126 L69 126 Z' },
  { muscle: 'glutes', d: 'M56 127 C65 123 73 126 74 137 L72 151 C63 153 56 149 54 140 Z' },
  { muscle: 'glutes', d: 'M76 137 C77 126 85 123 94 127 L96 140 C94 149 87 153 78 151 Z' },
  { muscle: 'hamstrings', d: 'M54 151 C63 149 70 151 72 159 L70 187 C62 190 55 185 53 177 Z' },
  { muscle: 'hamstrings', d: 'M78 159 C80 151 87 149 96 151 L97 177 C95 185 88 190 80 187 Z' },
  { muscle: 'calves', d: 'M52 190 C60 187 68 190 69 199 L67 233 L55 233 Z' },
  { muscle: 'calves', d: 'M81 199 C82 190 90 187 98 190 L95 233 L83 233 Z' },
];

const BODY_PATH =
  'M72 38 C87 38 98 48 99 61 L114 76 C119 81 121 91 119 99 L111 136 C109 144 102 144 100 136 L94 99 L95 128 L101 178 C102 187 98 196 97 205 L97 234 L82 234 L78 188 L75 150 L72 188 L68 234 L53 234 L53 205 C52 196 48 187 49 178 L55 128 L56 99 L50 136 C48 144 41 144 39 136 L31 99 C29 91 31 81 36 76 L51 61 C52 48 61 38 72 38 Z';

function getRegionShapes(side: BodyMapSide): RegionShape[] {
  return side === 'front' ? FRONT_REGION_SHAPES : BACK_REGION_SHAPES;
}

export function getMuscleRanking(muscleSummary: SessionMuscleSummary): MuscleRankingRow[] {
  return MUSCLE_GROUPS.map((muscle) => ({
    muscle,
    label: MUSCLE_LABELS[muscle],
    score: muscleSummary[muscle] ?? 0,
  }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || MUSCLE_GROUPS.indexOf(a.muscle) - MUSCLE_GROUPS.indexOf(b.muscle),
    );
}

export function getMuscleHighlightOpacity(
  muscleSummary: SessionMuscleSummary,
  muscle: MuscleGroup,
): number {
  const score = muscleSummary[muscle] ?? 0;
  if (score <= 0) return 0.18;

  const maxScore = Math.max(...Object.values(muscleSummary).filter((value) => value > 0), score);
  return 0.35 + (score / maxScore) * 0.55;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function BodyMapSvg({
  side,
  muscleSummary,
}: {
  side: BodyMapSide;
  muscleSummary: SessionMuscleSummary;
}) {
  return (
    <View style={styles.mapPanel} testID={`body-map-${side}`}>
      <Text style={styles.mapLabel}>{side}</Text>
      <Svg width="100%" height={260} viewBox="0 0 150 250" accessibilityRole="image">
        <Path d={BODY_PATH} fill={T.surface2} stroke={T.borderBright} strokeWidth={1.5} />
        <Ellipse cx={75} cy={23} rx={15} ry={17} fill={T.surface2} stroke={T.borderBright} />
        <Rect x={67} y={38} width={16} height={12} rx={4} fill={T.surface2} />
        {getRegionShapes(side).map((region, index) => {
          const score = muscleSummary[region.muscle] ?? 0;
          return (
            <Path
              key={`${side}-${region.muscle}-${index}`}
              d={region.d}
              fill={score > 0 ? T.accent : T.surface3}
              fillOpacity={getMuscleHighlightOpacity(muscleSummary, region.muscle)}
              stroke={T.bg}
              strokeOpacity={0.55}
              strokeWidth={1}
              testID={`body-map-region-${side}-${region.muscle}`}
            />
          );
        })}
      </Svg>
    </View>
  );
}

function MusclesWorkedSection({ muscleSummary }: { muscleSummary: SessionMuscleSummary }) {
  const ranking = getMuscleRanking(muscleSummary);

  return (
    <View style={styles.block} testID="muscles-worked-section">
      <Text style={styles.sectionLabel}>Muscles Worked</Text>
      <View style={styles.mapsRow}>
        <BodyMapSvg side="front" muscleSummary={muscleSummary} />
        <BodyMapSvg side="back" muscleSummary={muscleSummary} />
      </View>
      <View style={styles.ranking} testID="muscle-ranking">
        {ranking.length === 0 ? (
          <Text style={styles.emptyText}>No muscle data</Text>
        ) : (
          ranking.map((row) => (
            <View key={row.muscle} style={styles.rankingRow} testID={`muscle-rank-${row.muscle}`}>
              <Text style={styles.rankingName}>{row.label}</Text>
              <Text style={styles.rankingScore}>{formatScore(row.score)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default memo(MusclesWorkedSection);

const styles = StyleSheet.create({
  block: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.surface,
    padding: 14,
  },
  sectionLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  mapsRow: { flexDirection: 'row', gap: 10 },
  mapPanel: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    backgroundColor: T.bg,
    paddingTop: 8,
    overflow: 'hidden',
  },
  mapLabel: {
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  ranking: { marginTop: 12 },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  rankingName: { flex: 1, color: T.text, fontSize: 13 },
  rankingScore: {
    color: T.text,
    fontFamily: 'Courier New',
    fontSize: 13,
    textAlign: 'right',
  },
  emptyText: { color: T.textDim, fontSize: 13 },
});
