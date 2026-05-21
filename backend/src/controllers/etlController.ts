import { Request, Response } from 'express';
import { createDB, truncateDB } from '../etl/dbController.js';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { generateBulkTestData, insertBulkTestData, getTableCounts, runBulkPipelineInStages, runBulkPipelineStreaming } from '../etl/bulkDataController.js';
import { runBulkLoadFast } from '../etl/bulkLoadFast.js';
import { getEtlMetrics } from '../etl/etlMetrics.js';
import { uploadCsvToTable } from '../etl/csvUploadController.js';
import { runStreamingBenchmark } from '../etl/etlBenchmark.js';
import {
  subscribeToJob,
  getJob,
  getJobAsync,
  listJobsAsync,
  setJobAbortController,
  clearJobAbortController,
  cancelJob,
} from '../etl/jobRegistry.js';
import { getLastFailureForJob } from '../etl/etlFailures.js';
import {
  createIngestJobId,
  enqueueIngestJob,
  executeIngestJob,
  isEtlQueueReady,
} from '../etl/etlQueue.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { assertAdminActionKey } from '../lib/actionKey.js';
import { computeEtlProgressPercent } from '../lib/etlProgress.js';
import { etlLogger } from '../lib/logger.js';
import { unlinkIfExists } from '../lib/fsUtil.js';
import type { EtlIngestBody } from '../middleware/validation.js';
import type { EtlJobProgress } from '../etl/streaming/types.js';

function withEtlProgressFields(job: EtlJobProgress) {
  return {
    ...job,
    progressPercent: computeEtlProgressPercent(job.attemptedRows, job.estimatedTotal),
  };
}

export const etlController = {
  createDB: async (req: Request, res: Response) => {
    const result = await createDB();
    res.json({ success: true, message: 'Database tables created successfully', details: result });
  },

  truncateDB: async (req: Request, res: Response) => {
    const result = await truncateDB();
    res.json({ success: true, message: 'Database tables truncated successfully', details: result });
  },

  generateTestData: async (req: Request, res: Response) => {
    const result = await generateTestData();
    res.json({ success: true, message: 'Test data generated successfully', data: result });
  },

  insertTestData: async (req: Request, res: Response) => {
    const result = await insertTestData();
    res.json({ success: true, message: 'Test data inserted successfully', details: result });
  },

  generateRealData: async (req: Request, res: Response) => {
    const result = await generateRealData();
    res.json({ success: true, message: 'Real data generated successfully', data: result });
  },

  insertRealData: async (req: Request, res: Response) => {
    const result = await insertRealData();
    res.json({ success: true, message: 'Real data inserted successfully', details: result });
  },

  runFullTestPipeline: async (req: Request, res: Response) => {
    const results = {
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateTestData(),
      insert: await insertTestData(),
    };
    res.json({ success: true, message: 'Full test pipeline completed', details: results });
  },

  generateBulkData: async (req: Request, res: Response) => {
    const { customers = 1000, orders = 100000, linesPerOrder = 5, actionKey } = req.body;
    const estimatedLines = orders * linesPerOrder;

    if (estimatedLines > 1_000_000) {
      assertAdminActionKey(actionKey, 'bulk data generation over 1,000,000 rows');
    }

    const result = await generateBulkTestData({ customers, orders, linesPerOrder });
    res.json({ success: true, message: 'Bulk data generated successfully', data: result });
  },

  insertBulkData: async (req: Request, res: Response) => {
    const result = await insertBulkTestData();
    res.json({ success: true, message: 'Bulk data inserted successfully', data: result });
  },

  getTableCounts: async (req: Request, res: Response) => {
    const counts = await getTableCounts();
    res.json({ success: true, counts });
  },

  /** Generate + insert bulk data in stages (one batch at a time) to support 20M+ rows without OOM. */
  runBulkPipelineStages: async (req: Request, res: Response) => {
    const { totalOrders, ordersPerBatch, customers, linesPerOrder } = req.body as {
      totalOrders: number;
      ordersPerBatch?: number;
      customers?: number;
      linesPerOrder?: number;
    };
    const result = await runBulkPipelineInStages({
      totalOrders,
      ordersPerBatch,
      customers,
      linesPerOrder,
    });
    res.json({
      success: true,
      message: `Staged bulk pipeline completed: ${result.totalRows} rows in ${result.stages} stages`,
      ...result,
    });
  },

  /** Pure streaming bulk: O(1) memory, one order at a time into three parallel COPY streams. Best for 20M+ rows. */
  runBulkPipelineStreaming: async (req: Request, res: Response) => {
    const { totalOrders, customers, linesPerOrder } = req.body as {
      totalOrders: number;
      customers?: number;
      linesPerOrder?: number;
    };
    const result = await runBulkPipelineStreaming({ totalOrders, customers, linesPerOrder });
    res.json({
      success: true,
      message: `Streaming bulk pipeline completed: ${result.totalRows} rows`,
      ...result,
    });
  },

  /** Fast bulk loader using unlogged staging tables and sequential COPY (aiming for 200k+ rows/sec with flat heap). */
  runBulkLoadFast: async (req: Request, res: Response) => {
    const { totalOrders, customers, linesPerOrder, jobId } = req.body as {
      totalOrders: number;
      customers?: number;
      linesPerOrder?: number;
      jobId?: string;
    };
    const result = await runBulkLoadFast({ totalOrders, customers, linesPerOrder, jobId });
    res.json({
      success: true,
      message: `Fast bulk load completed: ${result.totalRows} rows`,
      ...result,
    });
  },

  /** ETL performance metrics: last streaming and bulk runs, heap, rows/sec. Query ?jobId= to filter. */
  getMetrics: async (req: Request, res: Response) => {
    const jobId = typeof req.query?.jobId === 'string' ? req.query.jobId : undefined;
    res.json(getEtlMetrics({ jobId }));
  },

  /** Generate a large CSV, run streaming ETL, return timing (rows/sec, rows/ms, ms/row). Query: ?rows=100000 (default 100k, max 2M). */
  streamingBenchmark: async (req: Request, res: Response) => {
    const raw = req.query?.rows;
    const requested = Math.min(
      Math.max(1, Number(typeof raw === 'string' ? raw : 100_000) || 100_000),
      2_000_000
    );
    const result = await runStreamingBenchmark(requested);
    res.json({
      success: true,
      message: `Streaming benchmark: ${result.insertedRows} rows in ${result.durationMs} ms`,
      benchmark: result,
      performance: {
        rowsPerSecond: result.rowsPerSecond,
        rowsPerMillisecond: result.rowsPerMillisecond,
        msPerInsertedRow: result.msPerInsertedRow,
      },
    });
  },

  runBulkPipeline: async (req: Request, res: Response) => {
    const { customers = 1000, orders = 100000, linesPerOrder = 5, actionKey } = req.body;
    const estimatedLines = orders * linesPerOrder;

    if (estimatedLines > 1_000_000) {
      assertAdminActionKey(actionKey, 'bulk pipeline over 1,000,000 rows');
    }
    
    etlLogger.info({ stage: 'bulk-pipeline-start' }, 'Starting bulk pipeline');
    const startTime = Date.now();
    
    const results = {
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateBulkTestData({ customers, orders, linesPerOrder }),
      insert: await insertBulkTestData(),
      totalTimeMs: 0,
    };
    
    results.totalTimeMs = Date.now() - startTime;
    etlLogger.info({ stage: 'bulk-pipeline-complete', durationMs: results.totalTimeMs }, 'Bulk pipeline completed');
    
    res.json({ success: true, message: 'Bulk pipeline completed', details: results });
  },

  uploadCsv: async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { table } = req.body as { table?: string };
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (table && !allowedTables.includes(table)) {
      throw new ValidationError(`Invalid table. Allowed: ${allowedTables.join(', ')}`);
    }

    const filePath = req.file.path;
    try {
      const { duration, table: detectedTable, rowCount, attemptedRows, rejectedRows } = await uploadCsvToTable(filePath, table);
      const msPerInsertedRow = rowCount > 0 ? Number((duration / rowCount).toFixed(3)) : null;
      const rowsPerSecond = duration > 0 ? Number(((rowCount * 1000) / duration).toFixed(2)) : 0;
      const rowsPerMillisecond = duration > 0 ? Number((rowCount / duration).toFixed(4)) : 0;

      res.json({
        success: true,
        message: `CSV lastet opp til ${detectedTable} (${rowCount}/${attemptedRows} rader)`,
        duration,
        table: detectedTable,
        rowCount,
        attemptedRows,
        rejectedRows,
        performance: {
          rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow
        },
        details: {
          insertedRows: rowCount,
          attemptedRows,
          rejectedRows,
          durationMs: duration,
          rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow
        }
      });
    } finally {
      await unlinkIfExists(filePath);
    }
  },

  ingestStream: async (req: Request<object, object, EtlIngestBody>, res: Response) => {
    const body = req.body;
    const {
      sourceType,
      table,
      async: runAsync,
      jobId: providedJobId,
      deadLetter,
      checkpoint,
      progressInterval,
    } = body;

    const shouldUseUploadedFile = sourceType === 'csv' || (sourceType === 'json' && req.file);
    const uploadedFilePath = req.file?.path;
    if (sourceType === 'csv' && !uploadedFilePath) {
      throw new ValidationError('CSV ingest requires an uploaded file (multipart field name: file)');
    }
    if (sourceType === 'json' && !uploadedFilePath) {
      throw new ValidationError('JSON ingest requires an uploaded file (multipart field name: file)');
    }

    const jobId = createIngestJobId(providedJobId);

    const payload = {
      jobId,
      body,
      uploadedFilePath: shouldUseUploadedFile ? uploadedFilePath : undefined,
    };

    if (runAsync && isEtlQueueReady()) {
      await enqueueIngestJob(payload);
      res.status(202).json({
        success: true,
        message: `ETL job queued for ${table}`,
        jobId,
        status: 'pending',
        pollUrl: `/api/etl/jobs/${jobId}`,
      });
      return;
    }

    const abortController = new AbortController();
    setJobAbortController(jobId, abortController);

    try {
      const result = await executeIngestJob(payload);

      const msPerInsertedRow =
        result.insertedRows > 0 ? Number((result.durationMs / result.insertedRows).toFixed(3)) : null;
      const rowsPerMillisecond =
        result.durationMs > 0 ? Number((result.insertedRows / result.durationMs).toFixed(4)) : 0;

      res.json({
        success: true,
        message: `Streaming ETL completed for ${result.table}`,
        jobId: result.jobId,
        details: result,
        performance: {
          rowsPerSecond: result.rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow,
        },
      });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        res.status(200).json({
          success: false,
          message: 'Job cancelled',
          jobId,
          cancelled: true,
        });
        return;
      }
      throw err;
    } finally {
      clearJobAbortController(jobId);
    }
  },

  cancelJob: async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'jobId required' });
      return;
    }
    const job = await getJobAsync(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    cancelJob(jobId);
    res.json({ success: true, message: 'Job cancellation requested', jobId });
  },

  listJobs: async (req: Request, res: Response) => {
    const raw = req.query?.limit;
    const limit = Math.min(Number(typeof raw === 'string' ? raw : undefined) || 100, 500);
    const jobs = await listJobsAsync(limit);
    res.json({ jobs: jobs.map(withEtlProgressFields) });
  },

  getJob: async (req: Request, res: Response) => {
    const job = await getJobAsync(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const lastFailure = await getLastFailureForJob(req.params.jobId);
    res.json({ ...withEtlProgressFields(job), lastFailure: lastFailure ?? undefined });
  },

  jobProgressSSE: async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'jobId required' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const unsubscribe = subscribeToJob(jobId, (progress) => {
      res.write(`data: ${JSON.stringify(withEtlProgressFields(progress))}\n\n`);
      const resWithFlush = res as Response & { flush?: () => void };
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush();
      }
    });

    const HEARTBEAT_INTERVAL_MS = 15_000;
    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(`: heartbeat ${Date.now()}\n\n`);
      const resWithFlush = res as Response & { flush?: () => void };
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush();
      }
    }, HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
};

