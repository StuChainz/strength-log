import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import FeedbackModal from '@/components/FeedbackModal';
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

export default function Settings() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const [settings, setSettings] = useState<AppSettings>({
    unit: 'kg',
    weekStartDay: 'monday',
    voiceMode: false,
    onboardingCompleted: false,
  });
  const [busy, setBusy] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          testID="settings-back-btn"
        >
          <Ionicons name="arrow-back" size={20} color={T.textDim} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Beta</Text>
          <Text style={styles.title}>Settings</Text>
        </View>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => setFeedbackVisible(true)}
          testID="settings-feedback-row"
        >
          <Ionicons name="chatbox-ellipses-outline" size={18} color={T.textDim} />
          <Text style={styles.actionText}>Send Feedback</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('Issues')}
          testID="settings-issues-row"
        >
          <Ionicons name="alert-circle-outline" size={18} color={T.textDim} />
          <Text style={styles.actionText}>Injuries</Text>
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
      <FeedbackModal
        visible={feedbackVisible}
        currentRoute="Settings"
        source="settings"
        onClose={() => setFeedbackVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 22, paddingTop: 14, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
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
