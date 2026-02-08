import { ForbiddenError } from '../middleware/errorHandler.js';

/**
 * Get admin action key - fails fast in production if not configured
 */
export function getAdminActionKey(): string {
  const key = process.env.ADMIN_ACTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: ADMIN_ACTION_KEY is not defined in production environment!');
    }
    console.warn('⚠️ WARNING: ADMIN_ACTION_KEY not set. Using dev-only fallback. Set ADMIN_ACTION_KEY in .env for security.');
    return '123';
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
