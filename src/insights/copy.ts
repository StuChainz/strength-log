import type { ConfidenceLabel } from '@/domain/types';

interface InsightCopyInput {
  title: string;
  tagLabel: string;
  metricLabel: string;
  relativeEffect: number;
  taggedCount: number;
  otherCount: number;
  confidence: ConfidenceLabel;
}

export function buildInsightCopy(input: InsightCopyInput): { title: string; body: string } {
  const direction = input.relativeEffect > 0 ? 'higher' : 'lower';
  const pct = Math.round(Math.abs(input.relativeEffect) * 100);
  return {
    title: input.title,
    body: `${input.tagLabel} sessions averaged ${pct}% ${direction} ${input.metricLabel} than other sessions across ${input.taggedCount + input.otherCount} workouts. Sample: ${input.taggedCount} tagged, ${input.otherCount} other. Confidence: ${input.confidence}.`,
  };
}
