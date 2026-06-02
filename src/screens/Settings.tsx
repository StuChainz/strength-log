import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb, resetLocalData } from '@/db/client';
import { exportDatabase } from '@/db/repositories/export.repo';
import {
  getAppSettings,
  setAppSetting,
  type AppSettings,
  type WeekStartDay,
} from '@/db/repositories/settings.repo';
import { T } from '@/theme/tokens';
import type { Unit } from '@/domain/types';
import type { SettingsNavigationProp } from '@/navigation/types';

const BETA_FEEDBACK_URL =
  'https://github.com/StuChainz/strength-log/issues/new?title=Beta%20feedback&body=1.%20Was%20logging%20fast%20enough%3F%0A%0A2.%20What%20felt%20confusing%3F%0A%0A3.%20Did%20suggestions%20help%3F%0A%0A4.%20What%20broke%3F%0A%0A5.%20What%20would%20you%20need%20next%3F%0A';

export default function Settings() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const [settings, setSettings] = useState<AppSettings>({
    unit: 'kg',
    weekStartDay: 'monday',
    voiceMode: false,
    onboardingCompleted: false,
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = await openDb();
    setSettings(await getAppSettings(db));
  }, []);

  useEffect(() => {
    // Loading local settings on mount is the screen's external synchronization point.
    void load();
  }, [load]);

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const db = await openDb();
    await setAppSetting(db, key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const db = await openDb();
      const payload = await exportDatabase(db);
      await Share.share({
        title: 'Strength Log export',
        message: JSON.stringify(payload, null, 2),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmWipe = () => {
    Alert.alert(
      'Wipe local data?',
      'This removes workouts, templates, tags, and settings on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe',
          style: 'destructive',
          onPress: () => {
            void resetLocalData().then(load);
          },
        },
      ],
    );
  };

  const feedback = async () => {
    const supported = await Linking.canOpenURL(BETA_FEEDBACK_URL);
    if (!supported) {
      Alert.alert('Beta feedback', 'Unable to open the feedback form right now.');
      return;
    }
    await Linking.openURL(BETA_FEEDBACK_URL);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Beta</Text>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Units</Text>
          <View style={styles.segmented}>
            {(['kg', 'lb'] as Unit[]).map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[styles.segment, settings.unit === unit && styles.segmentActive]}
                onPress={() => void update('unit', unit)}
              >
                <Text
                  style={[styles.segmentText, settings.unit === unit && styles.segmentTextActive]}
                >
                  {unit.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Week Starts</Text>
          <View style={styles.segmented}>
            {(['monday', 'sunday'] as WeekStartDay[]).map((day) => (
              <TouchableOpacity
                key={day}
                style={[styles.segment, settings.weekStartDay === day && styles.segmentActive]}
                onPress={() => void update('weekStartDay', day)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    settings.weekStartDay === day && styles.segmentTextActive,
                  ]}
                >
                  {day.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => void exportData()}
          disabled={busy}
        >
          <Ionicons name="share-outline" size={18} color={T.textDim} />
          <Text style={styles.actionText}>{busy ? 'Exporting…' : 'Export data'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={() => void feedback()}>
          <Ionicons name="chatbox-ellipses-outline" size={18} color={T.textDim} />
          <Text style={styles.actionText}>Beta feedback</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('Onboarding', { mode: 'revisit' })}
        >
          <Ionicons name="map-outline" size={18} color={T.textDim} />
          <Text style={styles.actionText}>View Onboarding</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionRow, styles.dangerRow]} onPress={confirmWipe}>
          <Ionicons name="trash-outline" size={18} color={T.danger} />
          <Text style={styles.dangerText}>Wipe local data</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 22, paddingTop: 16, paddingBottom: 28 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
  section: { marginTop: 24 },
  sectionLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 4,
  },
  segment: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 10 },
  segmentActive: { backgroundColor: T.accent },
  segmentText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: T.accentInk },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
  },
  actionText: { color: T.text, fontSize: 15, fontWeight: '700' },
  dangerRow: { borderColor: 'rgba(255,122,106,0.35)' },
  dangerText: { color: T.danger, fontSize: 15, fontWeight: '700' },
});
