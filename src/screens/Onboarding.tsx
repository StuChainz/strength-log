import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { setAppSetting } from '@/db/repositories/settings.repo';
import { T } from '@/theme/tokens';
import type { OnboardingNavigationProp } from '@/navigation/types';

interface OnboardingStep {
  title: string;
  body?: string;
  bullets: string[];
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  illustration?: 'logging' | 'summary';
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Set',
    body: 'Fast, local-first strength training logging.',
    bullets: ['Log workouts in seconds', 'Works offline', 'Never lose a workout'],
    cta: 'Get Started',
    icon: 'barbell-outline',
  },
  {
    title: 'Build Your Training',
    body: 'Set up the workouts you actually repeat.',
    bullets: [
      'Browse seeded exercises',
      'Create custom exercises',
      'Build and edit templates',
      'Save targets, notes, and rest times',
    ],
    cta: 'Next',
    icon: 'list-outline',
  },
  {
    title: 'Log A Live Workout',
    bullets: [
      'Tap in weight, reps, and optional RPE',
      'Track working, warm-up, and drop sets',
      'Edit, delete, or undo sets',
      'Use the rest timer between sets',
    ],
    cta: 'Next',
    icon: 'timer-outline',
    illustration: 'logging',
  },
  {
    title: 'Use Your History',
    body: 'See what happened last time before you log the next set.',
    bullets: [
      'Open recent exercise sessions',
      'Review top sets, volume, and estimated 1RM',
      'Use conservative next-set suggestions',
      'Keep PR tracking local',
    ],
    cta: 'Next',
    icon: 'time-outline',
  },
  {
    title: 'Never Lose A Workout',
    body: 'Your workout is saved as you train.',
    bullets: [
      'Recover in-progress sessions',
      'Avoid duplicate sets from double taps',
      'Keep an append-only event log',
      'Store everything on this device',
    ],
    cta: 'Next',
    icon: 'shield-checkmark-outline',
  },
  {
    title: 'Finish With A Clear Summary',
    body: 'After each workout, review the useful parts first.',
    bullets: ['Summary stats', 'Best Lift', 'Grouped PRs', 'Muscles trained'],
    cta: 'Next',
    icon: 'trophy-outline',
    illustration: 'summary',
  },
  {
    title: 'Add Context',
    body: 'The check-in after the summary keeps progress useful without slowing down logging.',
    bullets: ['Post-session tags', 'Energy rating', 'Session note', 'Finish later if needed'],
    cta: 'Next',
    icon: 'pricetags-outline',
  },
  {
    title: 'Review Progress',
    body: 'Use local training data to understand your work over time.',
    bullets: ['Weekly insight card', 'Training volume trends', 'Exercise history', 'JSON export'],
    cta: 'Next',
    icon: 'analytics-outline',
  },
  {
    title: 'Help Improve Set',
    body: "You're using a beta version.",
    bullets: [
      'Toggle kg/lb and voice mode in Settings',
      'Typed voice commands are optional',
      'Crashes',
      'Incorrect calculations',
      'Missing exercises',
      'Confusing behaviour',
      'Feedback is more valuable than feature requests.',
    ],
    cta: 'Start Logging',
    icon: 'chatbox-ellipses-outline',
  },
];

export default function Onboarding() {
  const navigation = useNavigation<OnboardingNavigationProp>();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;
  const progressLabel = useMemo(() => `${index + 1} of ${STEPS.length}`, [index]);

  const complete = async () => {
    setSaving(true);
    const db = await openDb();
    await setAppSetting(db, 'onboardingCompleted', true);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      }),
    );
  };

  const next = () => {
    if (isLast) {
      void complete();
      return;
    }
    setIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Text style={styles.progress}>{progressLabel}</Text>
          <View style={styles.dots} accessibilityLabel={progressLabel}>
            {STEPS.map((item) => (
              <View
                key={item.title}
                style={[styles.dot, item.title === step.title && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name={step.icon} size={26} color={T.accent} />
          </View>
          <Text style={styles.title}>{step.title}</Text>
          {step.body ? <Text style={styles.body}>{step.body}</Text> : null}
          {step.illustration === 'logging' ? <LoggingMockup /> : null}
          {step.illustration === 'summary' ? <SummaryMockup /> : null}
          <View style={styles.bullets}>
            {step.bullets.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Ionicons name="checkmark" size={16} color={T.accent} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.cta, saving && styles.ctaDisabled]}
          activeOpacity={0.9}
          onPress={next}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={T.accentInk} />
          ) : (
            <>
              <Text style={styles.ctaText}>{step.cta}</Text>
              <Ionicons name="arrow-forward" size={18} color={T.accentInk} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function LoggingMockup() {
  return (
    <View style={styles.mockup} testID="onboarding-log-set-mockup">
      <View style={styles.mockupHeader}>
        <Text style={styles.mockupTitle}>Bench Press</Text>
        <Text style={styles.mockupMeta}>Last: 60 kg x 8</Text>
      </View>
      <View style={styles.mockupInputs}>
        <View style={styles.mockupInput}>
          <Text style={styles.mockupLabel}>kg</Text>
          <Text style={styles.mockupValue}>62.5</Text>
        </View>
        <View style={styles.mockupInput}>
          <Text style={styles.mockupLabel}>reps</Text>
          <Text style={styles.mockupValue}>8</Text>
        </View>
      </View>
      <View style={styles.mockupButton}>
        <Text style={styles.mockupButtonText}>Log Set</Text>
      </View>
    </View>
  );
}

function SummaryMockup() {
  return (
    <View style={styles.mockup} testID="onboarding-summary-mockup">
      <View style={styles.summaryGrid}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>47</Text>
          <Text style={styles.mockupLabel}>min</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>2.4k</Text>
          <Text style={styles.mockupLabel}>kg</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>9</Text>
          <Text style={styles.mockupLabel}>PRs</Text>
        </View>
      </View>
      <View style={styles.bestLiftPreview}>
        <Text style={styles.mockupLabel}>Best lift</Text>
        <Text style={styles.mockupTitle}>Back Squat</Text>
        <Text style={styles.summaryLift}>120kg x 5</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  screen: {
    flex: 1,
    backgroundColor: T.bg,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
  },
  topBar: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: T.surface3,
  },
  dotActive: { width: 20, backgroundColor: T.accent },
  content: { flex: 1, justifyContent: 'center', paddingBottom: 20 },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: T.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700',
  },
  body: {
    color: T.textDim,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 14,
  },
  bullets: { gap: 10, marginTop: 22 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: { flex: 1, color: T.text, fontSize: 15, lineHeight: 21 },
  cta: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaDisabled: { opacity: 0.72 },
  ctaText: { color: T.accentInk, fontSize: 16, fontWeight: '800' },
  mockup: {
    marginTop: 22,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
  },
  mockupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  mockupTitle: { color: T.text, fontSize: 15, fontWeight: '700' },
  mockupMeta: { color: T.muted, fontFamily: 'Courier New', fontSize: 11 },
  mockupInputs: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mockupInput: {
    flex: 1,
    backgroundColor: T.surface2,
    borderRadius: 8,
    padding: 10,
  },
  mockupLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mockupValue: { color: T.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  mockupButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: T.accent,
    marginTop: 12,
  },
  mockupButtonText: { color: T.accentInk, fontSize: 13, fontWeight: '800' },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: T.surface2,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  summaryValue: { color: T.text, fontSize: 20, fontWeight: '800' },
  bestLiftPreview: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 8,
    padding: 12,
  },
  summaryLift: { color: T.accent, fontSize: 22, fontWeight: '900', marginTop: 8 },
});
