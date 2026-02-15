import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { etlController } from '../controllers/etlController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { etlLimiter } from '../middleware/rateLimit.js';
import { validate, bulkDataSchema, bulkStagesSchema, bulkStreamingSchema, etlIngestSchema } from '../middleware/validation.js';

export const etlRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configure multer with file size limits
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1, // Single file only
  }
});

// All ETL routes require admin access
etlRouter.use(authMiddleware, roleGuard('admin'));

// Apply ETL rate limiting to all routes (in production)
etlRouter.use(etlLimiter);

// Creates/recreates database tables
etlRouter.get('/createDB', asyncHandler(etlController.createDB));

// Truncates all data from database tables
etlRouter.get('/truncateDB', asyncHandler(etlController.truncateDB));

// Generates test data (CSV conversion or random generation)
etlRouter.get('/generateTestData', asyncHandler(etlController.generateTestData));

// Inserts test data into database
etlRouter.get('/insertTestData', asyncHandler(etlController.insertTestData));

// Generates real data from predefined sources
etlRouter.get('/generateRealData', asyncHandler(etlController.generateRealData));

// Inserts real data into database
etlRouter.get('/insertRealData', asyncHandler(etlController.insertRealData));

// Full pipeline: truncate -> create -> generate -> insert test data
etlRouter.get('/runFullTestPipeline', asyncHandler(etlController.runFullTestPipeline));

// ============= BULK DATA ROUTES (for millions of rows) =============

// Generate bulk test data (configurable size)
etlRouter.post('/generateBulkData', validate(bulkDataSchema), asyncHandler(etlController.generateBulkData));

// Insert bulk test data (optimized batch inserts)
etlRouter.get('/insertBulkData', asyncHandler(etlController.insertBulkData));

// Get table counts (fast estimates)
etlRouter.get('/tableCounts', asyncHandler(etlController.getTableCounts));

// ETL performance metrics (streaming + bulk runs, heap, rows/sec). Query ?jobId= to filter.
etlRouter.get('/metrics', asyncHandler(etlController.getMetrics));

// Streaming ETL benchmark: ?rows=100000 (default 100k, max 2M) – generates CSV, runs ETL, returns rows/sec and rows/ms
etlRouter.get('/benchmark', asyncHandler(etlController.streamingBenchmark));

// Full bulk pipeline with configurable size
etlRouter.post('/runBulkPipeline', validate(bulkDataSchema), asyncHandler(etlController.runBulkPipeline));

// Staged bulk pipeline: generate + insert in batches (for 10M–20M+ rows without OOM)
etlRouter.post('/runBulkPipelineStages', validate(bulkStagesSchema), asyncHandler(etlController.runBulkPipelineStages));

// Streaming bulk pipeline: O(1) memory, one order at a time, three parallel COPY streams (best for 20M+ rows)
etlRouter.post('/runBulkPipelineStreaming', validate(bulkStreamingSchema), asyncHandler(etlController.runBulkPipelineStreaming));

// Fast bulk loader using unlogged staging tables and sequential COPY streams (aiming for 200k+ rows/sec)
etlRouter.post('/runBulkLoadFast', validate(bulkStreamingSchema), asyncHandler(etlController.runBulkLoadFast));

// Upload CSV directly to database (Streaming COPY)
etlRouter.post('/upload-csv', upload.single('file'), asyncHandler(etlController.uploadCsv));

// Unified source ingest endpoint (csv/json/api)
etlRouter.post('/ingest', upload.single('file'), validate(etlIngestSchema), asyncHandler(etlController.ingestStream));

// ============= JOB TRACKING & PROGRESS (SSE) =============

// List recent ETL jobs
etlRouter.get('/jobs', asyncHandler(etlController.listJobs));

// Get single job status
etlRouter.get('/jobs/:jobId', asyncHandler(etlController.getJob));

// Cancel a running job (aborts the pipeline and marks job cancelled)
etlRouter.post('/jobs/:jobId/cancel', asyncHandler(etlController.cancelJob));

// Server-Sent Events stream for job progress (real-time updates)
etlRouter.get('/jobs/:jobId/progress', asyncHandler(etlController.jobProgressSSE));
