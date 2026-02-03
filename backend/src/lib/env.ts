import { z } from 'zod';

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
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Fails fast in production if critical vars are missing
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment configuration in production');
    }
    
    console.warn('⚠️ Continuing with defaults in development mode...');
  }
  
  const env = result.success ? result.data : envSchema.parse({
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
  });
  
  // Additional production checks
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) {
      throw new Error('CRITICAL: JWT_SECRET must be set in production (min 32 chars)');
    }
    if (!env.DATABASE_URL) {
      throw new Error('CRITICAL: DATABASE_URL must be set in production');
    }
  }
  
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

export default getEnv;
