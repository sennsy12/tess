import { z } from 'zod';
import { assertAdminActionKeyStrength } from '../middleware/productionSafety.js';

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Environment variable schema and validation
 * Validates and provides typed access to environment variables
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),

  // Database
  DATABASE_URL: z.string().optional(),

  // Auth - only enforced in production
  JWT_SECRET: z.string().optional(),

  // Privileged admin operations (user management, etc.)
  ADMIN_ACTION_KEY: z.string().optional(),

  // First-run admin bootstrap (see db/bootstrapAdmin.ts)
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  // Feature flags
  ENABLE_DESTRUCTIVE_ETL: z.string().optional(),
  ENABLE_SCHEDULER_JOBS: z.string().optional(),

  // CORS
  FRONTEND_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // AI assistant — optional; gemini (default) or openai
  ENABLE_ASSISTANT: z.string().optional(),
  ASSISTANT_PROVIDER: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ASSISTANT_MAX_OUTPUT_TOKENS: z.string().optional(),
  OPENAI_MAX_OUTPUT_TOKENS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Fails fast in production if critical vars are missing
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  let env: Env;
  if (result.success) {
    env = result.data;
  } else if (process.env.NODE_ENV === 'production') {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration in production');
  } else {
    // Development: drop only the offending keys and re-parse with defaults,
    // instead of re-parsing the identical input (which would throw again).
    const sanitized: Record<string, string | undefined> = { ...process.env };
    const offendingKeys = new Set<string>();
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') offendingKeys.add(key);
    }
    for (const key of offendingKeys) {
      console.warn(`⚠️ Ignoring invalid environment variable: ${key}`);
      delete sanitized[key];
    }
    const retry = envSchema.safeParse(sanitized);
    if (!retry.success) {
      console.error('❌ Environment validation still failing after cleanup:');
      console.error(retry.error.format());
      throw new Error('Invalid environment configuration');
    }
    env = retry.data;
  }

  // Additional production checks
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) {
      throw new Error('CRITICAL: JWT_SECRET must be set in production (min 32 chars)');
    }
    if (env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `CRITICAL: JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`
      );
    }
    if (!env.DATABASE_URL) {
      throw new Error('CRITICAL: DATABASE_URL must be set in production');
    }
    if (!env.ADMIN_ACTION_KEY) {
      throw new Error('CRITICAL: ADMIN_ACTION_KEY must be set in production');
    }
    assertAdminActionKeyStrength(env.ADMIN_ACTION_KEY);
    if (!env.FRONTEND_URL) {
      throw new Error('CRITICAL: FRONTEND_URL must be set in production (used for CORS)');
    }
    try {
      new URL(env.FRONTEND_URL);
    } catch {
      throw new Error('CRITICAL: FRONTEND_URL must be a valid absolute URL in production');
    }
  }

  // Propagate the validated NODE_ENV so modules that read process.env
  // directly (e.g. db connection resolution, scheduler flags) observe the
  // same value even when it was defaulted rather than explicitly set.
  process.env.NODE_ENV = env.NODE_ENV;

  return env;
}

// Export validated env (lazy initialization)
let _env: Env | null = null;
export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

/** Test-only: drop the cached parse so subsequent getEnv() calls re-read process.env. */
export function __resetEnvCacheForTests(): void {
  _env = null;
}

export default getEnv;
