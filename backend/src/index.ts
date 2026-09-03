import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { orderlinesRouter } from './routes/orderlines.js';
import { statisticsRouter } from './routes/statistics.js';
import { statusRouter } from './routes/status.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { catalogRouter } from './routes/catalog.js';
import { etlRouter } from './routes/etl.js';
import { schedulerRouter } from './routes/scheduler.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { reportsRouter } from './routes/reports.js';
import { tablePreferencesRouter } from './routes/tablePreferences.js';
import { pricingRouter } from './routes/pricing.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditRouter } from './routes/audit.js';
import { usersRouter } from './routes/users.js';
import { assistantRouter } from './routes/assistant.js';
import { notificationsRouter } from './routes/notifications.js';
import { clientEventsRouter } from './routes/clientEvents.js';
import { initializeDefaultJobs, stopAllJobs } from './scheduler/index.js';
import { initEtlQueue, stopEtlQueue } from './etl/etlQueue.js';
import { apiMetricsMiddleware } from './middleware/apiMetrics.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestIdMiddleware } from './http/requestId.js';
import { prometheusMiddleware, register, renderMetrics } from './metrics/prometheus.js';
import { logger } from './lib/logger.js';
import { validateEnv, getEnv } from './lib/env.js';
import { query } from './db/index.js';
import pool from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

// Validate environment at startup
try {
  validateEnv();
  logger.info('Environment validation passed');
} catch (error) {
  logger.fatal({ error }, 'Environment validation failed');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Validated at startup above; production requires FRONTEND_URL, so this
// fallback only ever applies in development/test.
const CORS_ORIGIN = getEnv().FRONTEND_URL || 'http://localhost:3000';

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

app.use(helmet());

// Correlation ID first so every log/error carries it.
app.use(requestIdMiddleware);

// Standard JSON limit for most routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// General rate limiting (skipped in development)
app.use('/api', generalLimiter);

// Prometheus HTTP observations (skips /metrics + health probes internally)
app.use(prometheusMiddleware);

// API metrics middleware - track response times
app.use('/api', apiMetricsMiddleware);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      requestId: (req as unknown as { id?: string }).id,
    };
    if (res.statusCode >= 400) {
      logger.warn(logData, 'Request completed with error');
    } else if (duration > 1000) {
      logger.warn(logData, 'Slow request');
    } else {
      logger.debug(logData, 'Request completed');
    }
  });
  next();
});

// Liveness probe
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe — verifies database connectivity.
// Deliberately minimal: this endpoint is unauthenticated, so internal
// connection-pool details are not exposed (available via metrics instead).
app.get('/api/health/ready', async (_req, res) => {  try {
    await query('SELECT 1');
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    logger.warn({ err }, 'Readiness check failed');
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// Prometheus scrape endpoint — NO auth by design (scrapers can't log in).
// Must stay inside the compose network: Caddy must never proxy /metrics.
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.send(await renderMetrics());
  } catch (err) {
    logger.warn({ err }, 'Metrics render failed');
    res.status(503).send('metrics unavailable');
  }
});

// Routes
app.use('/api/auth', authRouter);
// Unauthenticated browser telemetry — must be reachable for logged-out users.
app.use('/api', clientEventsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/orderlines', orderlinesRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/status', statusRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/catalog', catalogRouter);

// ETL Route needs higher payload limit for bulk uploads
app.use('/api/etl', express.json({ limit: '50mb' }), etlRouter);

app.use('/api/scheduler', schedulerRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/table-preferences', tablePreferencesRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);
app.use('/api/users', usersRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/notifications', notificationsRouter);

// Consistent JSON 404 (Express default is HTML, which breaks the API envelope).
app.use('/api', (_req, res) => {
  res.status(404).json({ status: 'error', error: 'Not found' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

let server: ReturnType<typeof app.listen> | undefined;
let isShuttingDown = false;

function setupGracefulShutdown(httpServer: ReturnType<typeof app.listen>) {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Shutting down gracefully');

    stopAllJobs();
    await stopEtlQueue();

    httpServer.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server');
      }
      try {
        await pool.end();
        logger.info('Database pool closed');
      } catch (poolErr) {
        logger.error({ poolErr }, 'Error closing database pool');
      }
      process.exit(err ? 1 : 0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function startServer() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    await runMigrations(pool);
    logger.info('Database migrations up to date');
  } catch (err) {
    logger.fatal({ err }, 'Database migration failed');
    process.exit(1);
  }

  // Create the first admin account if none exists (env-driven; prod requires
  // ADMIN_PASSWORD). Must run after migrations so `users` exists.
  try {
    const { bootstrapDefaultAdmin } = await import('./db/bootstrapAdmin.js');
    await bootstrapDefaultAdmin();
  } catch (err) {
    logger.fatal({ err }, 'Admin bootstrap failed');
    process.exit(1);
  }

  initializeDefaultJobs();

  // Heal missing fact-table FKs/indexes left by a crashed bulk ETL run.
  try {
    const { ensureFactTableIntegrity } = await import('./etl/bulkLoadFast/integrity.js');
    await ensureFactTableIntegrity();
  } catch (err) {
    logger.warn({ err }, 'Fact-table integrity check failed — bulk ETL will retry it before loading');
  }

  try {
    await initEtlQueue();
  } catch (err) {
    logger.warn({ err }, 'ETL queue failed to start — ingest will run synchronously');
  }

  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started');
  });

  server.timeout = 300000;
  setupGracefulShutdown(server);
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

export default app;
