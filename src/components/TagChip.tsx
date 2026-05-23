import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { T } from '@/theme/tokens';

interface TagChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function TagChip({ label, selected, onPress }: TagChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.84}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  chipSelected: {
    backgroundColor: T.accent,
    borderColor: T.accent,
  },
  text: {
    color: T.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
  textSelected: { color: T.accentInk },
});
