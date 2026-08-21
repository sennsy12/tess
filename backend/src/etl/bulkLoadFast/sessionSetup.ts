import type { PoolClient } from 'pg';
import { DEFAULT_WORK_MEM, DEFAULT_MAINT_WORK_MEM } from './shared.js';

/**
 * Create unlogged staging tables for ordre, ordrelinje, ordre_henvisning.
 * Uses LIKE ... INCLUDING DEFAULTS EXCLUDING CONSTRAINTS to avoid FK/PK overhead during COPY.
 */
export async function createUnloggedStagingTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordre (
      LIKE public.ordre INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordrelinje (
      LIKE public.ordrelinje INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordre_henvisning (
      LIKE public.ordre_henvisning INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);

  // Disable autovacuum during the high-throughput load; tables are staging-only.
  await client.query(`ALTER TABLE staging_ordre SET (autovacuum_enabled = false)`);
  await client.query(`ALTER TABLE staging_ordrelinje SET (autovacuum_enabled = false)`);
  await client.query(`ALTER TABLE staging_ordre_henvisning SET (autovacuum_enabled = false)`);

  // Ensure they start empty for this run.
  await client.query(`TRUNCATE TABLE staging_ordre, staging_ordrelinje, staging_ordre_henvisning`);
}

/** Tune work_mem / maintenance_work_mem for this session only. */
export async function setSessionWorkMem(client: PoolClient): Promise<void> {
  await client.query(`SET work_mem = '${DEFAULT_WORK_MEM}'`);
  await client.query(`SET maintenance_work_mem = '${DEFAULT_MAINT_WORK_MEM}'`);
  // Parallel B-tree builds during the post-load index rebuild.
  await client.query('SET max_parallel_maintenance_workers = 4');
}
