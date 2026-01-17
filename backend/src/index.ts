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
import { initializeDefaultJobs } from './scheduler/index.js';
import { apiMetricsMiddleware } from './middleware/apiMetrics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for bulk data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API metrics middleware - track response times
app.use('/api', apiMetricsMiddleware);

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
app.use('/api/etl', etlRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/suggestions', suggestionsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/pricing', pricingRouter);

// Initialize scheduler
initializeDefaultJobs();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;

