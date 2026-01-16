import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { etlController } from '../controllers/etlController.js';

export const etlRouter = Router();
const upload = multer({ dest: 'uploads/' });

// All ETL routes require admin access
etlRouter.use(authMiddleware, roleGuard('admin'));

// Creates/recreates database tables
etlRouter.get('/createDB', etlController.createDB);

// Truncates all data from database tables
etlRouter.get('/truncateDB', etlController.truncateDB);

// Generates test data (CSV conversion or random generation)
etlRouter.get('/generateTestData', etlController.generateTestData);

// Inserts test data into database
etlRouter.get('/insertTestData', etlController.insertTestData);

// Generates real data from predefined sources
etlRouter.get('/generateRealData', etlController.generateRealData);

// Inserts real data into database
etlRouter.get('/insertRealData', etlController.insertRealData);

// Full pipeline: truncate -> create -> generate -> insert test data
etlRouter.get('/runFullTestPipeline', etlController.runFullTestPipeline);

// ============= BULK DATA ROUTES (for millions of rows) =============

// Generate bulk test data (configurable size)
etlRouter.post('/generateBulkData', etlController.generateBulkData);

// Insert bulk test data (optimized batch inserts)
etlRouter.get('/insertBulkData', etlController.insertBulkData);

// Get table counts (fast estimates)
etlRouter.get('/tableCounts', etlController.getTableCounts);

// Full bulk pipeline with configurable size
etlRouter.post('/runBulkPipeline', etlController.runBulkPipeline);

// Upload CSV directly to database (Streaming COPY)
etlRouter.post('/upload-csv', upload.single('file'), etlController.uploadCsv);
