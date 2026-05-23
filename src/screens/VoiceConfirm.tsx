import { StyleSheet, Text, View } from 'react-native';
import { T } from '@/theme/tokens';
import type { IntentResult } from '@/voice/commands';

interface VoiceConfirmProps {
  result: IntentResult | null;
}

export default function VoiceConfirm({ result }: VoiceConfirmProps) {
  if (!result) return null;
  return (
    <View style={styles.chip}>
      <Text style={styles.intent}>{result.intent}</Text>
      <Text style={styles.confidence}>{result.confidence}</Text>
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
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  intent: { color: T.text, fontFamily: 'Courier New', fontSize: 12 },
  confidence: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
