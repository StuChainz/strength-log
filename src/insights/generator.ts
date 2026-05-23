import { buildInsightCopy } from './copy';
import {
  INSIGHT_PAIRS,
  MIN_GROUP_SESSIONS,
  MIN_RELATIVE_EFFECT,
  MIN_TOTAL_SESSIONS,
} from './thresholds';
import type { ConfidenceLabel } from '@/domain/types';

export interface InsightSession {
  id: string;
  startedAt: number;
  tags: string[];
  metrics: Record<string, number | null>;
}

export interface GeneratedInsight {
  generatedForWeekStart: number;
  title: string;
  body: string;
  sampleSize: number;
  confidenceLabel: ConfidenceLabel;
  payload: Record<string, unknown>;
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidence(sampleSize: number, relativeEffect: number): ConfidenceLabel {
  if (sampleSize >= 18 && Math.abs(relativeEffect) >= 0.2) return 'high';
  if (sampleSize >= 12) return 'medium';
  return 'low';
}

function label(value: string): string {
  return value
    .replace(/^session_/, '')
    .replace(/_session$/, '')
    .replace(/_/g, ' ');
}

function withoutLargest(values: number[]): number[] {
  if (values.length <= 1) return values;
  const mean = avg(values);
  let maxIndex = 0;
  let maxDistance = 0;
  values.forEach((value, index) => {
    const distance = Math.abs(value - mean);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  });
  return values.filter((_, index) => index !== maxIndex);
}

function outlierDrivesEffect(tagged: number[], other: number[], relativeEffect: number): boolean {
  const taggedTrimmed = withoutLargest(tagged);
  const otherTrimmed = withoutLargest(other);
  if (taggedTrimmed.length < MIN_GROUP_SESSIONS - 1 || otherTrimmed.length < MIN_GROUP_SESSIONS - 1) {
    return false;
  }
  const trimmedEffect = (avg(taggedTrimmed) - avg(otherTrimmed)) / Math.max(Math.abs(avg(otherTrimmed)), 1);
  return Math.sign(trimmedEffect) !== Math.sign(relativeEffect) || Math.abs(trimmedEffect) < MIN_RELATIVE_EFFECT;
}

export function generateWeeklyInsight(
  sessions: InsightSession[],
  weekStart: number,
): GeneratedInsight | null {
  if (sessions.length < MIN_TOTAL_SESSIONS) return null;

  for (const pair of INSIGHT_PAIRS) {
    const tagged = sessions
      .filter((session) => session.tags.includes(pair.tag))
      .map((session) => session.metrics[pair.metric])
      .filter((value): value is number => value !== null && value !== undefined);
    const other = sessions
      .filter((session) => !session.tags.includes(pair.tag))
      .map((session) => session.metrics[pair.metric])
      .filter((value): value is number => value !== null && value !== undefined);

    if (tagged.length < MIN_GROUP_SESSIONS || other.length < MIN_GROUP_SESSIONS) continue;

    const taggedAvg = avg(tagged);
    const otherAvg = avg(other);
    const relativeEffect = (taggedAvg - otherAvg) / Math.max(Math.abs(otherAvg), 1);
    if (Math.abs(relativeEffect) < MIN_RELATIVE_EFFECT) continue;
    if (outlierDrivesEffect(tagged, other, relativeEffect)) continue;

    const sampleSize = tagged.length + other.length;
    const confidenceLabel = confidence(sampleSize, relativeEffect);
    const copy = buildInsightCopy({
      title: pair.title,
      tagLabel: label(pair.tag),
      metricLabel: label(pair.metric),
      relativeEffect,
      taggedCount: tagged.length,
      otherCount: other.length,
      confidence: confidenceLabel,
    });

    return {
      generatedForWeekStart: weekStart,
      title: copy.title,
      body: copy.body,
      sampleSize,
      confidenceLabel,
      payload: {
        tag: pair.tag,
        metric: pair.metric,
        taggedAvg,
        otherAvg,
        relativeEffect,
        sessionIds: sessions.map((session) => session.id),
      },
    };
  }

  return null;
}

export function weekStartMonday(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  return date.getTime();
}

export function canRunWeeklyInsight(now: number): boolean {
  const date = new Date(now);
  return date.getDay() === 0 && date.getHours() >= 19;
}
