import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
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
