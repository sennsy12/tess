/**
 * Initial admin bootstrap.
 *
 * Replaces the old practice of seeding a known `admin/admin123` row from
 * init.sql (which prod compose mounted on first boot). Instead:
 *   - If any admin user already exists → no-op (existing deployments keep working).
 *   - Otherwise, create the first admin from ADMIN_USERNAME / ADMIN_PASSWORD.
 *   - In production, a missing or weak ADMIN_PASSWORD is a hard startup
 *     failure — the system must never boot with known credentials.
 *
 * Runs once at startup, right after migrations.
 *
 * @module db/bootstrapAdmin
 */
import bcrypt from 'bcrypt';
import { query } from './index.js';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const BCRYPT_ROUNDS = 10;
const MIN_PROD_ADMIN_PASSWORD_LENGTH = 12;

export async function bootstrapDefaultAdmin(): Promise<void> {
  const existing = await query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  if (existing.rowCount && existing.rowCount > 0) {
    return;
  }

  const env = getEnv();
  const username = env.ADMIN_USERNAME?.trim() || 'admin';

  if (env.NODE_ENV === 'production') {
    if (!env.ADMIN_PASSWORD) {
      throw new Error(
        'CRITICAL: No admin user exists and ADMIN_PASSWORD is not set. ' +
          'Set ADMIN_PASSWORD (min ' +
          MIN_PROD_ADMIN_PASSWORD_LENGTH +
          ' chars) to create the initial admin account.'
      );
    }
    if (env.ADMIN_PASSWORD.length < MIN_PROD_ADMIN_PASSWORD_LENGTH) {
      throw new Error(
        `CRITICAL: ADMIN_PASSWORD must be at least ${MIN_PROD_ADMIN_PASSWORD_LENGTH} characters`
      );
    }
  }

  // Development/test fallback keeps local DX identical to the previous seed.
  const password = env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, hash]
  );

  logger.info({ username }, 'Bootstrapped initial admin user');
}
