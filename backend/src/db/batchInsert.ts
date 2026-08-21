/**
 * Multi-value batch INSERT helper.
 *
 * @module db/batchInsert
 */
import pool from './pool.js';
import { quoteIdentifier, SAFE_IDENTIFIER_RE } from './identifiers.js';

/**
 * Insert many rows using a multi-value `INSERT … VALUES` statement.
 *
 * Rows are chunked into batches of `batchSize` to stay under the
 * PostgreSQL parameter limit. Uses `ON CONFLICT DO NOTHING` to skip
 * duplicates.
 *
 * **Note:** `tableName` and `columns` are interpolated into the SQL text
 * (identifiers cannot be bound as query parameters). They are validated
 * against a strict identifier pattern and quoted defensively before use.
 *
 * @param tableName - Target table (plain identifier, e.g. `ordre`)
 * @param columns   - Column names (plain identifiers)
 * @param rows      - Array of value-arrays, one per row
 * @param batchSize - Max rows per INSERT statement (default `10 000`)
 * @returns Total number of rows inserted
 */
export const batchInsert = async (
  tableName: string,
  columns: string[],
  rows: any[][],
  batchSize: number = 10000
): Promise<number> => {
  if (rows.length === 0) return 0;

  if (!SAFE_IDENTIFIER_RE.test(tableName)) {
    throw new Error(`Invalid table name for batchInsert: ${JSON.stringify(tableName)}`);
  }
  const invalidCols = columns.filter((c) => !SAFE_IDENTIFIER_RE.test(c));
  if (invalidCols.length > 0) {
    throw new Error(
      `Invalid columns for table ${tableName}: ${invalidCols.map((c) => JSON.stringify(c)).join(', ')}`
    );
  }

  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    // Build parameterized query with multiple value sets
    const placeholders = batch.map((_, rowIndex) => {
      const rowPlaceholders = columns.map((_, colIndex) =>
        `$${rowIndex * columns.length + colIndex + 1}`
      );
      return `(${rowPlaceholders.join(', ')})`;
    }).join(', ');

    const flatValues = batch.flat();

    const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;

    const result = await pool.query(sql, flatValues);
    totalInserted += result.rowCount || 0;
  }

  return totalInserted;
};
