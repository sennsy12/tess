import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../lib/logger.js';

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
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess';
  return new Pool({ connectionString });
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

    for (const file of files) {
      const existing = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (existing.rowCount && existing.rowCount > 0) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        logger.info({ migration: file }, 'Applied database migration');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
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
