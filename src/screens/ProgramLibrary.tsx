import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ALL_PRESETS } from '@/programs/presets';
import { T } from '@/theme/tokens';
import type { ProgramLibraryNavigationProp } from '@/navigation/types';

export default function ProgramLibrary() {
  const navigation = useNavigation<ProgramLibraryNavigationProp>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            testID="program-library-back"
          >
            <Ionicons name="chevron-back" size={20} color={T.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>Programmes</Text>
          <Text style={styles.title}>Browse presets</Text>
          <Text style={styles.subtitle}>
            Built-in programmes you can import as editable templates.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.presetList}>
            {ALL_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={styles.presetRow}
                onPress={() => navigation.navigate('ProgramPreview', { presetId: preset.id })}
                testID={`preset-row-${preset.id}`}
                activeOpacity={0.7}
              >
                <View style={styles.presetInfo}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetMeta}>
                    {preset.daysPerWeek}D/WK · {preset.experienceLevel.toUpperCase()}
                  </Text>
                  <Text style={styles.presetDesc} numberOfLines={2}>
                    {preset.shortDescription}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={T.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 24 },

  header: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 4 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginLeft: -6,
    marginBottom: 8,
  },
  backText: { color: T.text, fontSize: 15, fontWeight: '500' },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: T.text, marginTop: 4 },
  subtitle: { color: T.textDim, fontSize: 13.5, marginTop: 6, lineHeight: 19 },

  section: { paddingHorizontal: 22, paddingTop: 18 },
  presetList: { gap: 10 },
  presetRow: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presetInfo: { flex: 1, minWidth: 0 },
  presetName: { fontSize: 15, fontWeight: '600', color: T.text },
  presetMeta: {
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 0.8,
    color: T.muted,
    marginTop: 4,
  },
  presetDesc: { color: T.textDim, fontSize: 13, marginTop: 6, lineHeight: 18 },
});
