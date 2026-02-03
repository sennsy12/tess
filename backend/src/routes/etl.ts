import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { etlController } from '../controllers/etlController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { etlLimiter } from '../middleware/rateLimit.js';
import { validate, bulkDataSchema } from '../middleware/validation.js';

export const etlRouter = Router();

// Configure multer with file size limits
const upload = multer({ 
  dest: 'uploads/',
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

// Full bulk pipeline with configurable size
etlRouter.post('/runBulkPipeline', validate(bulkDataSchema), asyncHandler(etlController.runBulkPipeline));

// Upload CSV directly to database (Streaming COPY)
etlRouter.post('/upload-csv', upload.single('file'), asyncHandler(etlController.uploadCsv));

