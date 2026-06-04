import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/theme/tokens';
import type { InsightsNavigationProp } from '@/navigation/types';

export default function Insights() {
  const navigation = useNavigation<InsightsNavigationProp>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Weekly</Text>
        <Text style={styles.title}>Insights</Text>
        <TouchableOpacity
          style={styles.reportLink}
          activeOpacity={0.84}
          onPress={() => navigation.navigate('TrainingVolume')}
          testID="training-volume-link"
        >
          <View>
            <Text style={styles.reportLabel}>REPORT</Text>
            <Text style={styles.reportTitle}>Training Volume (Last 7 Days)</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={T.mutedDeep} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 22, paddingTop: 16, paddingBottom: 24 },
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
  reportLink: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.surface,
    padding: 14,
  },
  reportLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    textTransform: 'uppercase',
  },
  reportTitle: { color: T.text, fontSize: 14, fontWeight: '600', marginTop: 3 },
});
