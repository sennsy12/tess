import type { PoolClient } from 'pg';
import { AppError } from '../middleware/errorHandler.js';
import pool from '../db/pool.js';

/**
 * Advisory-lock key shared by all bulk ETL jobs. A single constant so every
 * entry point serializes on the same lock, across ALL app processes (the old
 * in-process boolean only guarded a single Node worker while staging tables
 * are global and permanent).
 */
const BULK_ETL_ADVISORY_LOCK_ID = 918_273_645;

/**
 * Serialize destructive bulk ETL jobs (Generate Bulk, Run Bulk Pipeline*,
 * Bulk Load Fast). These jobs share global unlogged staging tables, so two
 * concurrent runs would corrupt each other's data.
 *
 * Implemented with pg_try_advisory_lock so the guard holds across multiple
 * backend processes/replicas, and is released automatically by PostgreSQL if
 * the process dies mid-job (session-scoped). The second caller gets 409.
 */
export async function withBulkLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    const lockResult = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [BULK_ETL_ADVISORY_LOCK_ID]
    );
    if (!lockResult.rows[0]?.locked) {
      throw new AppError('Another bulk ETL job is already running. Wait for it to finish.', 409);
    }
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [BULK_ETL_ADVISORY_LOCK_ID]).catch(() => {});
    }
  } finally {
    client.release();
  }
}
