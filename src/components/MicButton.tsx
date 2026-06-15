import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

export function MicButton() {
  const { tokens: T } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: T.surface,
          borderColor: T.border,
        },
      ]}
      onPress={() => Alert.alert('Coming soon', 'Voice controls are not available yet.')}
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
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
