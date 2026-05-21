import { query } from '../db/index.js';

/** Schema-safe row estimate from pg_class (suitable for status dashboards). */
export async function estimateTableRowCount(tableName: string, schema = 'public'): Promise<number> {
  const result = await query(
    `SELECT COALESCE(c.reltuples, 0)::bigint AS estimate
     FROM pg_class c
     INNER JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = $1 AND n.nspname = $2`,
    [tableName, schema],
  );
  return parseInt(result.rows[0]?.estimate ?? '0', 10);
}
