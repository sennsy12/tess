import { ForbiddenError } from '../middleware/errorHandler.js';
import { assertAdminActionKeyStrength } from '../middleware/productionSafety.js';

/**
 * Get admin action key - fails fast unless configured.
 *
 * The fallback is only permitted in development/test. In any other
 * environment a missing key throws, otherwise the well-known constant would
 * unlock privileged admin operations (password changes, deletes).
 */
export function getAdminActionKey(): string {
  const env = process.env.NODE_ENV;
  const allowsFallback = env === 'development' || env === 'test';
  const key = process.env.ADMIN_ACTION_KEY;
  if (!key) {
    if (!allowsFallback) {
      throw new Error(
        `CRITICAL: ADMIN_ACTION_KEY is not defined (NODE_ENV=${env ?? 'unset'}).`
      );
    }
    console.warn('⚠️ WARNING: ADMIN_ACTION_KEY not set. Using dev-only fallback. Set ADMIN_ACTION_KEY in .env for security.');
    return 'dev-only-action-key-not-for-production';
  }
  if (process.env.NODE_ENV === 'production') {
    assertAdminActionKeyStrength(key);
  }
  return key;
}

/**
 * Assert a valid admin action key for privileged actions
 */
export function assertAdminActionKey(providedKey: string | undefined, context: string) {
  const expectedKey = getAdminActionKey();
  if (!providedKey || providedKey !== expectedKey) {
    throw new ForbiddenError(`Invalid action key for ${context}`);
  }
}
