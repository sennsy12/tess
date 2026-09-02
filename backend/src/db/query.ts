/**
 * Query helpers on the shared pool.
 *
 * @module db/query
 */
import pool from './pool.js';
import type { PoolClient } from 'pg';
import { dbLogger } from '../lib/logger.js';

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
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
  options?: { isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' },
): Promise<T> => {
  const client = await pool.connect();
  try {
    if (options?.isolationLevel) {
      await client.query(`BEGIN ISOLATION LEVEL ${options.isolationLevel}`);
    } else {
      await client.query('BEGIN');
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Never mask the original error with a rollback failure.
      dbLogger.error({ rollbackErr }, 'Transaction ROLLBACK failed');
    }
    throw error;
  } finally {
    client.release();
  }
};
