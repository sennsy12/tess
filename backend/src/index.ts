import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { orderlinesRouter } from './routes/orderlines.js';
import { statisticsRouter } from './routes/statistics.js';
import { statusRouter } from './routes/status.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { etlRouter } from './routes/etl.js';
import { schedulerRouter } from './routes/scheduler.js';
import { suggestionsRouter } from './routes/suggestions.js';
import { reportsRouter } from './routes/reports.js';
import { pricingRouter } from './routes/pricing.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditRouter } from './routes/audit.js';
import { usersRouter } from './routes/users.js';
import { initializeDefaultJobs } from './scheduler/index.js';
import { apiMetricsMiddleware } from './middleware/apiMetrics.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { logger } from './lib/logger.js';
import { validateEnv } from './lib/env.js';

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

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Standard JSON limit for most routes
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// General rate limiting (skipped in development)
app.use('/api', generalLimiter);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/orderlines', orderlinesRouter);
app.use('/api/statistics', statisticsRouter);
app.use('/api/status', statusRouter);
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);

// ETL Route needs higher payload limit for bulk uploads
app.use('/api/etl', express.json({ limit: '50mb' }), etlRouter);

app.use('/api/scheduler', schedulerRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);
app.use('/api/users', usersRouter);

// Initialize scheduler
initializeDefaultJobs();

// Error handling middleware (must be last)
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server started');
});

// Increase timeout to 5 minutes for large ETL jobs
server.timeout = 300000;

export default app;

