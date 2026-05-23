import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/theme/tokens';

export default function Insights() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Coming soon</Text>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.sub}>
          Weekly patterns from your tagged sessions. Log a few workouts and add tags to unlock.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1, padding: 22, paddingTop: 16 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: T.text,
    marginTop: 4,
  },
  sub: {
    fontSize: 14,
    color: T.textDim,
    marginTop: 12,
    lineHeight: 20,
  },
});
