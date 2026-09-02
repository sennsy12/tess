/**
 * Memoized `information_schema` column lookup for COPY validation.
 * Short TTL avoids a round-trip on every call in hot ETL loops.
 *
 * @module db/copy/columns
 */
import pool from '../pool.js';

const tableColumnCache = new Map<string, { cols: Set<string>; expiresAt: number }>();
const TABLE_COLUMN_CACHE_TTL_MS = 60_000;

export const getTableColumns = async (tableName: string): Promise<Set<string>> => {
  const cached = tableColumnCache.get(tableName);
  if (cached && cached.expiresAt > Date.now()) return cached.cols;
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    ['public', tableName],
  );
  const cols = new Set(result.rows.map((r: { column_name: string }) => r.column_name));
  tableColumnCache.set(tableName, { cols, expiresAt: Date.now() + TABLE_COLUMN_CACHE_TTL_MS });
  return cols;
};

/** Test hook: clear the table-column memoization cache. */
export const clearTableColumnsCache = (): void => {
  tableColumnCache.clear();
};
