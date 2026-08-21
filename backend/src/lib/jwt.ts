const DEV_FALLBACK_SECRET = 'dev-only-fallback-secret-do-not-use-in-production';

/**
 * Environments where an insecure fallback secret may be used.
 * Anything else (production, staging, unset NODE_ENV) fails closed so a
 * misconfigured deployment can never sign tokens with a known constant.
 */
function allowsFallbackSecret(): boolean {
  const env = process.env.NODE_ENV;
  return env === 'development' || env === 'test';
}

/**
 * JWT secret resolution — single source for auth middleware and controllers.
 *
 * Fails closed when JWT_SECRET is missing outside development/test:
 * signing with a publicly-known constant would allow full authentication
 * bypass via forged tokens.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (!allowsFallbackSecret()) {
      throw new Error(
        `CRITICAL: JWT_SECRET is not defined (NODE_ENV=${process.env.NODE_ENV ?? 'unset'}). ` +
          'Refusing to sign tokens with a fallback secret.'
      );
    }
    console.warn(
      'WARNING: JWT_SECRET not set. Using dev-only fallback. Set JWT_SECRET in .env for security.'
    );
    return DEV_FALLBACK_SECRET;
  }
  return secret;
}

/** Algorithm allowlist for jwt.sign/jwt.verify – prevents algorithm confusion. */
export const JWT_ALGORITHMS = ['HS256'] as const;
