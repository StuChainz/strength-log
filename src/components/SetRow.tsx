import { StyleSheet, Text, View } from 'react-native';
import type { WorkoutSet } from '@/domain/types';

interface SetRowProps {
  set: WorkoutSet;
  index: number;
}

export function SetRow({ set, index }: SetRowProps) {
  const weightStr = set.weight !== null ? `${set.weight} ${set.unit}` : '—';
  const repsStr = set.reps !== null ? `× ${set.reps}` : '';
  const rpeStr = set.rpe !== null ? ` @ RPE ${set.rpe}` : '';
  const setType = set.set_type === 'warmup' ? 'WARM-UP' : set.set_type.toUpperCase();

  return (
    <View style={styles.row} testID={`set-row-${set.id}`}>
      <Text style={styles.index}>Set {index + 1}</Text>
      <Text style={styles.data}>
        {weightStr}
        {repsStr.length > 0 ? `  ${repsStr}` : ''}
        {rpeStr}
      </Text>
      <Text style={styles.setType}>{setType}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    gap: 12,
  },
  index: {
    color: '#555',
    fontSize: 13,
    fontWeight: '500',
    width: 44,
  },
  data: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  setType: {
    color: '#777',
    fontSize: 10,
    fontWeight: '700',
  },
});
