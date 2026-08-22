/**
 * ETL crash-recovery & money-type integration tests.
 *
 * Runs against a REAL PostgreSQL instance, isolated in a throwaway database
 * (`tess_integration_test`) that this suite creates, migrates, and drops.
 * The dev database is never touched.
 *
 * Opt-in via env var (keeps default CI green):
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npx jest etlCrashRecovery
 *
 * @module tests/integration/etlCrashRecovery
 */
import { Pool } from 'pg';

const ADMIN_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess';
const TEST_DB_NAME = 'tess_integration_test';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/?]+(\?.*)?$/, `/${TEST_DB_NAME}`);

const maybeDescribe = process.env.TEST_DATABASE_URL !== undefined ? describe : describe.skip;

let adminPool: Pool;
let dbPool: Pool;

maybeDescribe('ETL crash recovery (integration)', () => {
  beforeAll(async () => {
    adminPool = new Pool({ connectionString: ADMIN_URL, max: 1 });
    // Terminate stray connections from a previous crashed run before dropping.
    await adminPool.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
    `);
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);

    // db modules resolve their connection string at import time — set the
    // target BEFORE importing them.
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = TEST_DB_URL;

    // Base schema first (migrations assume init.sql tables exist), then
    // versioned migrations — same sequence as a real deployment.
    const fs = await import('fs/promises');
    const path = await import('path');
    const initSql = await fs.readFile(
      path.join(process.cwd(), '..', 'init.sql'),
      'utf-8'
    );
    const bootstrap = new Pool({ connectionString: TEST_DB_URL, max: 1 });
    try {
      await bootstrap.query(initSql);
    } finally {
      await bootstrap.end();
    }

    const { runMigrations } = await import('../../db/migrate.js');
    await runMigrations();
    const poolModule = await import('../../db/pool.js');
    dbPool = poolModule.default as unknown as Pool;
  }, 60_000);

  afterAll(async () => {
    if (dbPool) await dbPool.end();
    if (adminPool) {
      await adminPool.query(`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
      `).catch(() => {});
      await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`).catch(() => {});
      await adminPool.end();
    }
  }, 30_000);

  describe('copyFromLineStream atomicity', () => {
    it('commits NOTHING to the final table when the COPY stream fails mid-way', async () => {
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS crash_test (
          id integer PRIMARY KEY,
          amount numeric(12,2)
        )
      `);

      const lines: string[] = [];
      for (let i = 1; i <= 100; i++) lines.push(`${i}\t${(i * 1.5).toFixed(2)}\n`);
      // Poison row: non-integer primary key aborts the server-side COPY…
      lines.push('not_an_integer\t99.00\n');
      for (let i = 101; i <= 150; i++) lines.push(`${i}\t${(i * 1.5).toFixed(2)}\n`);

      const { copyFromLineStream } = await import('../../db/copyLoaders.js');
      await expect(
        copyFromLineStream(
          'crash_test',
          ['id', 'amount'],
          (async function* generateSourceLines() {
            for (const line of lines) yield line;
          })(),
          'nothing'
        )
      ).rejects.toThrow();

      const count = await dbPool.query('SELECT COUNT(*)::int AS c FROM crash_test');
      expect(count.rows[0].c).toBe(0);

      await dbPool.query('DROP TABLE IF EXISTS crash_test');
    });

    it('returns NUMERIC values as JS numbers (money type parser)', async () => {
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS crash_test_money (
          id integer PRIMARY KEY,
          amount numeric(12,2)
        )
      `);
      await dbPool.query("INSERT INTO crash_test_money VALUES (1, '1234.56')");

      const result = await dbPool.query('SELECT amount FROM crash_test_money WHERE id = 1');
      expect(result.rows[0].amount).toBe(1234.56);
      expect(typeof result.rows[0].amount).toBe('number');

      await dbPool.query('DROP TABLE IF EXISTS crash_test_money');
    });
  });

  describe('checkpoint format gating', () => {
    it('ignores and removes legacy (v1) checkpoints that record uncommitted rows', async () => {
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etl-cp-'));
      process.env.ETL_CHECKPOINT_DIR = dir;
      const cp = await import('../../etl/checkpoint.js');

      await fs.writeFile(
        path.join(dir, 'checkpoint-legacy-job.json'),
        JSON.stringify({ jobId: 'legacy-job', table: 'ordre', lastProcessedIndex: 50_000 })
      );
      await expect(cp.loadCheckpoint('legacy-job')).resolves.toBeNull();
      await expect(fs.access(path.join(dir, 'checkpoint-legacy-job.json'))).rejects.toThrow();
    });

    it('round-trips v2 checkpoints atomically', async () => {
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etl-cp2-'));
      process.env.ETL_CHECKPOINT_DIR = dir;
      const cp = await import('../../etl/checkpoint.js');

      await cp.saveCheckpoint({
        v: 2,
        jobId: 'v2-job',
        table: 'ordre',
        lastProcessedIndex: 10,
        lastProcessedAt: new Date().toISOString(),
      });
      const loaded = await cp.loadCheckpoint('v2-job');
      expect(loaded?.v).toBe(2);
      expect(loaded?.lastProcessedIndex).toBe(10);

      delete process.env.ETL_CHECKPOINT_DIR;
    });
  });

  describe('migrateStagingToFinal transaction safety', () => {
    it('rolls back cleanly on in-transaction failure and leaves the connection usable', async () => {
      const { getClient } = await import('../../db/index.js');
      const { createUnloggedStagingTables } = await import(
        '../../etl/bulkLoadFast/sessionSetup.js'
      );
      const { migrateStagingToFinal } = await import('../../etl/bulkLoadFast/staging.js');

      const client = await getClient();
      try {
        await createUnloggedStagingTables(client);
        await client.query("INSERT INTO staging_ordre (ordrenr, sum) VALUES (990002, '42.00')");

        // Deterministic failure injection: break the source column of the
        // very first INSERT so the transaction aborts after BEGIN.
        await client.query('ALTER TABLE staging_ordre RENAME COLUMN sum TO sum_disabled');

        await expect(migrateStagingToFinal(client)).rejects.toThrow();

        // The connection must NOT be poisoned: post-failure queries work and
        // staging rows survived the rollback.
        await client.query('SELECT 1');
        await client.query('ALTER TABLE staging_ordre RENAME COLUMN sum_disabled TO sum');
        const staged = await client.query('SELECT COUNT(*)::int AS c FROM staging_ordre');
        expect(staged.rows[0].c).toBeGreaterThan(0);
      } finally {
        client.release();
      }

      // Fact-table FKs/indexes are dropped before the transaction; the shared
      // integrity healer must be able to restore them afterwards.
      const { ensureFactTableIntegrity } = await import('../../etl/bulkLoadFast/integrity.js');
      await ensureFactTableIntegrity();

      const fkCheck = await dbPool.query(`
        SELECT COUNT(*)::int AS c FROM information_schema.table_constraints
        WHERE table_name = 'ordre' AND constraint_type = 'FOREIGN KEY'
      `);
      expect(fkCheck.rows[0].c).toBeGreaterThan(0);
    }, 60_000);

    it('merges committed staging rows into fact tables and truncates staging', async () => {
      const { getClient } = await import('../../db/index.js');
      const { createUnloggedStagingTables } = await import(
        '../../etl/bulkLoadFast/sessionSetup.js'
      );
      const { migrateStagingToFinal } = await import('../../etl/bulkLoadFast/staging.js');

      const client = await getClient();
      try {
        await client.query('TRUNCATE TABLE staging_ordre, staging_ordrelinje, staging_ordre_henvisning');
        await createUnloggedStagingTables(client);

        await client.query("INSERT INTO staging_ordre (ordrenr, sum) VALUES (990001, '100.00')");
        await client.query(
          "INSERT INTO staging_ordrelinje (linjenr, ordrenr, antall, nettpris, linjesum) VALUES (1, 990001, '2.000', '50.00', '100.00')"
        );

        const result = await migrateStagingToFinal(client);
        expect(result.ordrer).toBeGreaterThanOrEqual(1);

        const order = await client.query(
          'SELECT ordrenr, sum FROM ordre WHERE ordrenr = 990001'
        );
        expect(order.rows).toHaveLength(1);
        expect(order.rows[0].sum).toBe(100); // number, not string — DECIMAL parser

        const stagedAfter = await client.query('SELECT COUNT(*)::int AS c FROM staging_ordre');
        expect(stagedAfter.rows[0].c).toBe(0);

        // Cleanup so repeat runs stay deterministic.
        await client.query('DELETE FROM ordre_henvisning WHERE ordrenr = 990001');
        await client.query('DELETE FROM ordrelinje WHERE ordrenr = 990001');
        await client.query('DELETE FROM ordre WHERE ordrenr = 990001');
      } finally {
        client.release();
      }
    }, 60_000);
  });
});
