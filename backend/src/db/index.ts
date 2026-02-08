/**
 * Database Access Layer
 *
 * Provides low-level helpers for querying PostgreSQL:
 * - `query`       – Execute a single parameterised query
 * - `getClient`   – Acquire a client from the pool (for manual txn management)
 * - `transaction`  – Execute a callback inside a BEGIN/COMMIT/ROLLBACK block
 * - `batchInsert` – Insert many rows via multi-value INSERT
 * - `bulkCopy`    – High-throughput insert using PostgreSQL COPY protocol
 * - `getPoolStats` – Expose pool health for monitoring
 *
 * @module db
 */
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { dbLogger } from '../lib/logger.js';

dotenv.config();

// Pool tuned for high-throughput parallel COPY and batch operations
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess',
  // Maximum number of clients in the pool (increased for parallel COPY)
  max: 50,
  // Minimum number of idle clients
  min: 10,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  // Return error after 10 seconds if connection cannot be established
  connectionTimeoutMillis: 10000,
  // Maximum time a query can run before timing out (5 minutes for large operations)
  statement_timeout: 300000,
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  dbLogger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  dbLogger.error({ error: err.message }, 'Unexpected error on idle client');
});

/**
 * Execute a single parameterised SQL query and return the result.
 * Queries taking longer than 100 ms are logged as warnings.
 *
 * @param text   - SQL text with `$1`, `$2`, … placeholders
 * @param params - Bind parameters matching the placeholders
 * @returns The `pg.QueryResult` from the driver
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) { // Only log slow queries
    dbLogger.warn({ query: text.substring(0, 100), duration, rows: res.rowCount }, 'Slow query detected');
  }
  return res;
};

/**
 * Acquire a dedicated client from the connection pool.
 *
 * **Important:** The caller is responsible for calling `client.release()`
 * when done. Prefer {@link transaction} for most use-cases.
 *
 * @returns A `PoolClient` instance
 */
export const getClient = () => pool.connect();

/**
 * Execute a callback inside a database transaction.
 *
 * Automatically calls BEGIN before the callback, COMMIT on success,
 * and ROLLBACK + rethrow on error. The client is always released
 * back to the pool regardless of outcome.
 *
 * @param callback - Async function receiving the `PoolClient`
 * @returns Whatever the callback resolves to
 *
 * @example
 * ```ts
 * const user = await transaction(async (client) => {
 *   await client.query('INSERT INTO users …');
 *   return client.query('SELECT * FROM users WHERE …');
 * });
 * ```
 */
export const transaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Insert many rows using a multi-value `INSERT … VALUES` statement.
 *
 * Rows are chunked into batches of `batchSize` to stay under the
 * PostgreSQL parameter limit. Uses `ON CONFLICT DO NOTHING` to skip
 * duplicates.
 *
 * **Note:** `tableName` and `columns` are interpolated directly into
 * the SQL text. Callers must ensure these values are trusted and not
 * derived from user input.
 *
 * @param tableName - Target table (must be a trusted identifier)
 * @param columns   - Column names (must be trusted identifiers)
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
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
    
    const result = await pool.query(sql, flatValues);
    totalInserted += result.rowCount || 0;
  }
  
  return totalInserted;
};

/**
 * High-throughput insert using the PostgreSQL `COPY` protocol.
 *
 * 5–10x faster than multi-value INSERT for large datasets.
 * When `onConflict` is `'nothing'`, data is first COPY-ed into a
 * temporary table, then merged into the real table with
 * `ON CONFLICT DO NOTHING`.
 *
 * **Warning:** `tableName` and `columns` are interpolated directly –
 * ensure they are trusted identifiers. Rows are converted to
 * tab-separated text and streamed in 50 000-row chunks to limit
 * memory pressure.
 *
 * @param tableName  - Target table (trusted identifier)
 * @param columns    - Column names to populate (trusted identifiers)
 * @param rows       - Array of value-arrays, one per row
 * @param onConflict - Conflict strategy: `'nothing'` (default) or `'error'`
 * @returns Number of rows actually inserted
 */
export const bulkCopy = async (
  tableName: string,
  columns: string[],
  rows: any[][],
  onConflict: 'nothing' | 'error' = 'nothing'
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    const copyStreams = await import('pg-copy-streams');
    
    // Use a temp table for ON CONFLICT DO NOTHING support
    const tempTable = `temp_${tableName}_${Date.now()}`;
    
    // Start transaction to keep temp table alive
    await client.query('BEGIN');
    
    if (onConflict === 'nothing') {
      // Create temp table with same structure (no constraints to speed up COPY)
      // EXCEPT for SERIAL columns which should be excluded from the COPY if not provided
      await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);
      
      // If the table has an 'id' column that is a serial, we might need to handle it
      // For the users table, the 'id' column is SERIAL and NOT NULL.
      // When we CREATE TEMP TABLE ... LIKE ..., the NOT NULL constraint is copied.
      // If we don't provide 'id' in the COPY, it fails.
      // Let's remove the NOT NULL constraint from the temp table for the columns we are NOT copying
      const allColsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
      `);
      const allCols = allColsResult.rows.map((r: any) => r.column_name);
      const missingCols = allCols.filter((c: string) => !columns.includes(c));
      
      for (const col of missingCols) {
        await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${col} DROP NOT NULL`);
      }
    }
    
    const targetTable = onConflict === 'nothing' ? tempTable : tableName;
    
    const stream = client.query(
      copyStreams.from(`COPY ${targetTable} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
    );

    const copyResult = await new Promise<number>((resolve, reject) => {
      stream.on('error', (err: Error) => {
        reject(err);
      });

      stream.on('finish', async () => {
        try {
          if (onConflict === 'nothing') {
            // Insert from temp to real table with ON CONFLICT DO NOTHING
            const result = await client.query(`
              INSERT INTO ${tableName} (${columns.join(', ')})
              SELECT ${columns.join(', ')} FROM ${tempTable}
              ON CONFLICT DO NOTHING
            `);
            resolve(result.rowCount || 0);
          } else {
            resolve(rows.length);
          }
        } catch (err) {
          reject(err);
        }
      });

      // Convert rows to tab-separated text and write to stream
      // Process in chunks to avoid memory issues
      const CHUNK_SIZE = 50000;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const text = chunk.map(row => 
          row.map((val: any) => {
            if (val === null || val === undefined) return '\\N';
            // Escape special characters for COPY format
            return String(val)
              .replace(/\\/g, '\\\\')
              .replace(/\t/g, '\\t')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
          }).join('\t')
        ).join('\n') + '\n';
        
        stream.write(text);
      }
      
      stream.end();
    });

    await client.query('COMMIT');
    return copyResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Return live connection-pool statistics for health-check endpoints.
 *
 * @returns `{ totalCount, idleCount, waitingCount }`
 */
export const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount,
});

export default pool;
