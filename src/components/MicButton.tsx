import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/theme/tokens';

export function MicButton() {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => Alert.alert('Coming soon', 'Typed voice parsing is available in debug builds.')}
      activeOpacity={0.8}
    >
      <Ionicons name="mic-outline" size={22} color={T.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
