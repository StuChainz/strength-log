export const EXPORT_TABLES = [
  'users',
  'exercises',
  'exercise_aliases',
  'exercise_metadata',
  'templates',
  'template_items',
  'workout_sessions',
  'workout_events',
  'workout_sets',
  'exercise_history_cache',
  'post_session_tags',
  'session_notes',
  'metric_samples',
  'weekly_insight_cards',
  'app_settings',
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export interface StrengthLogExport {
  schemaVersion: 1;
  exportedAt: string;
  tables: Record<ExportTable, unknown[]>;
}

export const STRENGTH_LOG_EXPORT_SCHEMA = {
  type: 'object',
  required: ['schemaVersion', 'exportedAt', 'tables'],
  properties: {
    schemaVersion: { const: 1 },
    exportedAt: { type: 'string' },
    tables: {
      type: 'object',
      required: EXPORT_TABLES,
    },
  },
} as const;

export function validateExportPayload(payload: StrengthLogExport): boolean {
  return (
    payload.schemaVersion === 1 &&
    typeof payload.exportedAt === 'string' &&
    EXPORT_TABLES.every((table) => Array.isArray(payload.tables[table]))
  );
}
