import { query } from '../db/index.js';

export interface TablePreferencesRow {
  user_id: number;
  table_key: string;
  visible_columns: string[] | null;
  column_labels: Record<string, string>;
  updated_at: Date;
}

export interface TablePreferencesInput {
  visibleColumns?: string[] | null;
  columnLabels?: Record<string, string>;
}

const EMPTY_LABELS: Record<string, string> = {};

export const tablePreferencesModel = {
  get: async (userId: number, tableKey: string): Promise<TablePreferencesRow | null> => {
    const result = await query(
      `SELECT user_id, table_key, visible_columns, column_labels, updated_at
       FROM user_table_preferences
       WHERE user_id = $1 AND table_key = $2`,
      [userId, tableKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      user_id: row.user_id,
      table_key: row.table_key,
      visible_columns: (row.visible_columns as string[] | null) ?? null,
      column_labels: (row.column_labels as Record<string, string> | null) ?? { ...EMPTY_LABELS },
      updated_at: row.updated_at,
    };
  },

  upsert: async (
    userId: number,
    tableKey: string,
    input: TablePreferencesInput,
  ): Promise<TablePreferencesRow> => {
    const result = await query(
      `INSERT INTO user_table_preferences (user_id, table_key, visible_columns, column_labels, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
       ON CONFLICT (user_id, table_key)
       DO UPDATE SET
         visible_columns = EXCLUDED.visible_columns,
         column_labels = EXCLUDED.column_labels,
         updated_at = NOW()
       RETURNING user_id, table_key, visible_columns, column_labels, updated_at`,
      [
        userId,
        tableKey,
        input.visibleColumns !== undefined ? JSON.stringify(input.visibleColumns) : null,
        JSON.stringify(input.columnLabels ?? {}),
      ],
    );
    const row = result.rows[0];
    return {
      user_id: row.user_id,
      table_key: row.table_key,
      visible_columns: (row.visible_columns as string[] | null) ?? null,
      column_labels: (row.column_labels as Record<string, string> | null) ?? { ...EMPTY_LABELS },
      updated_at: row.updated_at,
    };
  },
};
