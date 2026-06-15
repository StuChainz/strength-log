import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { IntentResult } from '@/voice/commands';

interface VoiceConfirmProps {
  result: IntentResult | null;
}

export default function VoiceConfirm({ result }: VoiceConfirmProps) {
  const { tokens: T } = useTheme();

  if (!result) return null;
  return (
    <View style={[styles.chip, { backgroundColor: T.surface, borderColor: T.border }]}>
      <Text style={[styles.intent, { color: T.text }]}>{result.intent}</Text>
      <Text style={[styles.confidence, { color: T.muted }]}>{result.confidence}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  intent: { fontFamily: 'Courier New', fontSize: 12 },
  confidence: {
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
