import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { etlController } from '../controllers/etlController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { etlLimiter } from '../middleware/rateLimit.js';
import { validate, bulkDataSchema, bulkStagesSchema, bulkStreamingSchema, etlIngestSchema } from '../middleware/validation.js';
import { requireDestructiveEtl } from '../middleware/productionSafety.js';
import { AppError } from '../middleware/errorHandler.js';

export const etlRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_UPLOAD_EXTENSIONS = /\.(csv|txt)$/i;
const ALLOWED_UPLOAD_MIMES = new Set([
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream', // common on Windows for .csv
]);

// Configure multer with file size limits
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 1, // Single file only
  },
  // Only accept CSV uploads — reject anything else before it hits disk.
  fileFilter: (_req, file, cb) => {
    const extOk = ALLOWED_UPLOAD_EXTENSIONS.test(file.originalname);
    const mimeOk = ALLOWED_UPLOAD_MIMES.has(file.mimetype);
    if (!extOk || !mimeOk) {
      cb(new AppError('Only CSV files are accepted', 400));
      return;
    }
    cb(null, true);
  },
});

// All ETL routes require admin access
etlRouter.use(authMiddleware, roleGuard('admin'));

// Apply ETL rate limiting to all routes (in production)
etlRouter.use(etlLimiter);

// Destructive / test-data routes — disabled in production unless ENABLE_DESTRUCTIVE_ETL=true
const destructive = requireDestructiveEtl;

etlRouter.get('/createDB', destructive, asyncHandler(etlController.createDB));
etlRouter.get('/truncateDB', destructive, asyncHandler(etlController.truncateDB));
etlRouter.get('/generateTestData', destructive, asyncHandler(etlController.generateTestData));
etlRouter.get('/insertTestData', destructive, asyncHandler(etlController.insertTestData));
etlRouter.get('/generateRealData', destructive, asyncHandler(etlController.generateRealData));
etlRouter.get('/insertRealData', destructive, asyncHandler(etlController.insertRealData));
etlRouter.get('/runFullTestPipeline', destructive, asyncHandler(etlController.runFullTestPipeline));

// ============= BULK DATA ROUTES (for millions of rows) =============

etlRouter.post('/generateBulkData', destructive, validate(bulkDataSchema), asyncHandler(etlController.generateBulkData));
etlRouter.get('/insertBulkData', destructive, asyncHandler(etlController.insertBulkData));

// Get table counts (fast estimates)
etlRouter.get('/tableCounts', asyncHandler(etlController.getTableCounts));

// ETL performance metrics (streaming + bulk runs, heap, rows/sec). Query ?jobId= to filter.
etlRouter.get('/metrics', asyncHandler(etlController.getMetrics));

// Streaming ETL benchmark: ?rows=100000 (default 100k, max 2M) – generates CSV, runs ETL, returns rows/sec and rows/ms
etlRouter.get('/benchmark', asyncHandler(etlController.streamingBenchmark));

etlRouter.post('/runBulkPipeline', destructive, validate(bulkDataSchema), asyncHandler(etlController.runBulkPipeline));
etlRouter.post('/runBulkPipelineStages', destructive, validate(bulkStagesSchema), asyncHandler(etlController.runBulkPipelineStages));
etlRouter.post('/runBulkPipelineStreaming', destructive, validate(bulkStreamingSchema), asyncHandler(etlController.runBulkPipelineStreaming));
etlRouter.post('/runBulkLoadFast', destructive, validate(bulkStreamingSchema), asyncHandler(etlController.runBulkLoadFast));

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
