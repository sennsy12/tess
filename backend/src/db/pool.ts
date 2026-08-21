/**
 * PostgreSQL connection pool.
 *
 * Single shared pool tuned for high-throughput parallel COPY and batch
 * operations. All other db modules import the pool from here so exactly
 * one pool exists per process.
 *
 * @module db/pool
 */
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { dbLogger } from '../lib/logger.js';
import { getEnv } from '../lib/env.js';

dotenv.config();

// DATABASE_URL falls back to a local dev credential only when the validated
// environment explicitly says development/test. Production startup validation
// (lib/env.ts) already requires DATABASE_URL; failing closed here too prevents
// a silent connect to well-known superuser credentials on a misconfigured host.
const DEV_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/tess';
function resolveDatabaseUrl(): string {
  const env = getEnv();
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
    dbLogger.warn('DATABASE_URL not set – falling back to local development database');
    return DEV_DATABASE_URL;
  }
  throw new Error(
    `CRITICAL: DATABASE_URL is not defined (NODE_ENV=${env.NODE_ENV}). Refusing to guess connection settings.`
  );
}

const poolConfig: PoolConfig = {
  connectionString: resolveDatabaseUrl(),
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
