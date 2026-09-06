import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Log keys/paths that are always redacted. Secrets must never reach
 * stdout/shipper output even if a caller logs a whole config object.
 * `*` covers any nesting depth for the named keys.
 */
export const loggerRedactPaths = [
  '*.password',
  '*.passwd',
  '*.token',
  '*.authorization',
  '*.api_key',
  '*.apiKey',
  '*.secret',
  '*.DATABASE_URL',
  '*.JWT_SECRET',
  '*.ADMIN_ACTION_KEY',
  '*.SMTP_PASS',
  // Additive hardening: refresh/identity tokens + AI keys must never reach
  // stdout/shipper output even if a caller logs a whole auth/config object.
  '*.refreshToken',
  'refreshToken',
  '*.idToken',
  'idToken',
  '*.entraOid',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  '*.GEMINI_API_KEY',
  '*.OPENAI_API_KEY',
  'password',
  'passwd',
  'token',
  'authorization',
  'api_key',
  'DATABASE_URL',
  'JWT_SECRET',
  'ADMIN_ACTION_KEY',
  'SMTP_PASS',
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  redact: {
    paths: loggerRedactPaths,
    censor: '[REDACTED]',
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  // Production format: JSON for log aggregation
  ...(isDevelopment ? {} : {
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
});

// Create child loggers for different modules
export const createLogger = (module: string) => logger.child({ module });

// Convenience loggers
export const dbLogger = createLogger('db');
export const authLogger = createLogger('auth');
export const etlLogger = createLogger('etl');
export const apiLogger = createLogger('api');

export default logger;
