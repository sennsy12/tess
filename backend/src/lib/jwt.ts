/**
 * JWT secret resolution — single source for auth middleware and controllers.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET is not defined in production environment!');
    }
    console.warn(
      'WARNING: JWT_SECRET not set. Using dev-only fallback. Set JWT_SECRET in .env for security.',
    );
    return 'dev-only-fallback-secret-do-not-use-in-production';
  }
  return secret;
}
