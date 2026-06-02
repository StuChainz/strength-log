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
  illustration?: 'logging';
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Set',
    body: 'Fast strength training logging.',
    bullets: ['Log workouts in seconds', 'Works offline', 'Never lose a workout'],
    cta: 'Get Started',
  },
  {
    title: 'Log Sets Quickly',
    bullets: [
      'Choose an exercise',
      'Enter weight and reps',
      'Tap Log Set',
      'Rest timer starts automatically',
    ],
    cta: 'Next',
    illustration: 'logging',
  },
  {
    title: 'Never Lose A Workout',
    body: 'Your workout is saved as you train.\n\nIf the app closes, crashes, or your phone dies:',
    bullets: ['Reopen Set', 'Resume where you left off'],
    cta: 'Next',
  },
  {
    title: 'See What You Did Last Time',
    body: 'Every exercise can show:',
    bullets: ['Previous sessions', 'Recent performance', 'Conservative next-set suggestions'],
    cta: 'Next',
  },
  {
    title: 'Review Your Training',
    body: 'After every workout:',
    bullets: ['Session summary', 'Muscle map', 'PR tracking', 'Training volume'],
    cta: 'Next',
  },
  {
    title: 'Help Improve Set',
    body: "You're using a beta version.\n\nPlease report:",
    bullets: [
      'Crashes',
      'Incorrect calculations',
      'Missing exercises',
      'Confusing behaviour',
      'Feedback is more valuable than feature requests.',
    ],
    cta: 'Start Logging',
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
            <Ionicons name="barbell-outline" size={26} color={T.accent} />
          </View>
          <Text style={styles.title}>{step.title}</Text>
          {step.body ? <Text style={styles.body}>{step.body}</Text> : null}
          {step.illustration === 'logging' ? <LoggingMockup /> : null}
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
  bullets: { gap: 12, marginTop: 24 },
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
});
