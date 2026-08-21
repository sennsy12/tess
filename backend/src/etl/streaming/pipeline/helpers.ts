import { etlLogger } from '../../../lib/logger.js';
import { ValidationError } from '../../../middleware/errorHandler.js';
import {
  getRowValidationError,
  normalizeHeader,
  normalizeRecord,
  transformValue,
} from '../transforms.js';
import { ColumnPlanItem, EtlTableName } from '../types.js';

export const CHECKPOINT_SAVE_INTERVAL = 50_000;

export function mapRow(
  row: Record<string, unknown>,
  rowIndex: number,
  table: EtlTableName,
  strictMode: boolean,
  columnPlan: ColumnPlanItem[]
): { values: Array<string | number | null> | null; error: string | null } {
  const normalized = normalizeRecord(row);
  const values = columnPlan.map(({ sourceKey, dbColumn }) => {
    const raw = normalized[normalizeHeader(sourceKey)] ?? '';
    return transformValue(dbColumn, raw, rowIndex);
  });

  const valueByColumn = new Map<string, string | number | null>();
  columnPlan.forEach((item, idx) => valueByColumn.set(item.dbColumn, values[idx]));
  const error = getRowValidationError(table, valueByColumn);
  if (error) {
    if (strictMode) {
      throw new ValidationError(`Invalid row at index ${rowIndex} for table ${table}: ${error}`);
    }
    return { values: null, error };
  }
  return { values, error: null };
}

export async function withRetries<T>(
  operation: () => Promise<T>,
  label: string,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt += 1;
      if (attempt > maxRetries) throw error;
      const err = error as Error;
      const delayMs = 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 120);
      etlLogger.warn({ label, attempt, delayMs, error: err?.message }, 'Retrying ETL operation');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
