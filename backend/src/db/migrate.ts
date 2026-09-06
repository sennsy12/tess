import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../lib/logger.js';
import { ensureOrderCustomerSeq } from './ensureSequences.js';

dotenv.config();

function resolveMigrationsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'dist', 'db', 'migrations'),
    path.join(process.cwd(), 'src', 'db', 'migrations'),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  return found ?? candidates[0];
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) return new Pool({ connectionString });
  // Fail closed in production — never guess superuser credentials.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: DATABASE_URL is not defined in production. Refusing to migrate.');
  }
  return new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/tess' });
}

/**
 * Apply pending SQL migrations from db/migrations (sorted by filename).
 */
export async function runMigrations(pool?: Pool): Promise<void> {
  const ownsPool = !pool;
  const db = pool ?? createPool();
  const migrationsDir = resolveMigrationsDir();

  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (!fs.existsSync(migrationsDir)) {
      logger.warn({ dir: migrationsDir }, 'Migrations directory not found');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Serialize multi-replica deploys: only one migrator runs at a time.
    // pg_advisory_lock is session-scoped, so hold ONE client for the whole run.
    const lockClient = await db.connect();
    try {
      await lockClient.query("SELECT pg_advisory_lock(hashtext('tess_schema_migrations'))");
      try {
        for (const file of files) {
          const existing = await lockClient.query(
            'SELECT 1 FROM schema_migrations WHERE version = $1',
            [file],
          );
          if (existing.rowCount && existing.rowCount > 0) {
            continue;
          }

          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          try {
            await lockClient.query('BEGIN');
            await lockClient.query(sql);
            await lockClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
            await lockClient.query('COMMIT');
            logger.info({ migration: file }, 'Applied database migration');
          } catch (err) {
            try {
              await lockClient.query('ROLLBACK');
            } catch {
              // ignore — original error is what matters
            }
            throw err;
          }
        }
      } finally {
        await lockClient.query("SELECT pg_advisory_unlock(hashtext('tess_schema_migrations'))");
      }
    } finally {
      lockClient.release();
    }

    // Startup reheal for ordre_customer_seq (ETL imports can overtake it;
    // see ensureSequences.ts). Deliberately NOT awaited: runMigrations must
    // never block server startup on this, and the helper itself never
    // throws (best-effort with warn). src/index.ts is owned by another
    // agent, so the hook lives here — index.ts already awaits
    // runMigrations(pool) at startup.
    ensureOrderCustomerSeq().then(
      (status) => {
        if (status !== 'ok') {
          logger.warn({ status }, 'ordre_customer_seq startup reheal skipped');
        }
      },
      (err) => {
        logger.warn({ err }, 'ordre_customer_seq startup reheal failed (best-effort)');
      },
    );
  } finally {
    if (ownsPool) {
      await db.end();
    }
  }
}

/** CLI entry: npm run migrate */
const isMain = process.argv[1]?.includes('migrate');

if (isMain) {
  runMigrations()
    .then(() => {
      logger.info('Migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Migration failed');
      process.exit(1);
    });
}
