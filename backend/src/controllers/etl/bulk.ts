import { Request, Response } from 'express';
import { createDB, truncateDB } from '../../etl/dbController.js';
import { generateBulkTestData, getTableCounts, runBulkPipelineStreaming } from '../../etl/bulkDataController.js';
import { runBulkLoadFast } from '../../etl/bulkLoadFast.js';
import { getEtlMetrics } from '../../etl/etlMetrics.js';
import { runStreamingBenchmark } from '../../etl/etlBenchmark.js';
import { assertAdminActionKey } from '../../lib/actionKey.js';
import { etlLogger } from '../../lib/logger.js';
import { withBulkLock } from '../../etl/bulkLock.js';

export const etlBulkHandlers = {
  generateBulkData: async (req: Request, res: Response) => {
    const { customers = 1000, orders = 100000, linesPerOrder = 5, actionKey } = req.body;
    const estimatedLines = orders * linesPerOrder;

    if (estimatedLines > 1_000_000) {
      assertAdminActionKey(actionKey, 'bulk data generation over 1,000,000 rows');
    }

    const result = await withBulkLock('generateBulkData', () => generateBulkTestData({ customers, orders, linesPerOrder }));
    res.json({ success: true, message: 'Bulk data generated and streamed into database', data: result });
  },

  /** Data is inserted during generation (streaming); kept for API compatibility. */
  insertBulkData: async (_req: Request, res: Response) => {
    const counts = await getTableCounts();
    res.json({
      success: true,
      message: 'No separate insert step needed: generateBulkData streams rows directly into the database.',
      counts,
    });
  },

  getTableCounts: async (req: Request, res: Response) => {
    const counts = await getTableCounts();
    res.json({ success: true, counts });
  },

  /** Kept for API compatibility: delegates to the O(1)-memory streaming pipeline. */
  runBulkPipelineStages: async (req: Request, res: Response) => {
    const { totalOrders, customers, linesPerOrder } = req.body as {
      totalOrders: number;
      ordersPerBatch?: number;
      customers?: number;
      linesPerOrder?: number;
    };
    const result = await withBulkLock('runBulkPipelineStages', () =>
      runBulkPipelineStreaming({
        totalOrders,
        customers,
        linesPerOrder,
      })
    );
    res.json({
      success: true,
      message: `Streaming bulk pipeline completed: ${result.totalRows} rows (single pass, O(1) memory)`,
      ...result,
      stages: 1,
    });
  },

  /** Pure streaming bulk: O(1) memory, one order at a time into three parallel COPY streams. Best for 20M+ rows. */
  runBulkPipelineStreaming: async (req: Request, res: Response) => {
    const { totalOrders, customers, linesPerOrder } = req.body as {
      totalOrders: number;
      customers?: number;
      linesPerOrder?: number;
    };
    const result = await withBulkLock('runBulkPipelineStreaming', () =>
      runBulkPipelineStreaming({ totalOrders, customers, linesPerOrder })
    );
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
    const result = await withBulkLock('runBulkLoadFast', () =>
      runBulkLoadFast({ totalOrders, customers, linesPerOrder, jobId })
    );
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

    const results = await withBulkLock('runBulkPipeline', async () => ({
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateBulkTestData({ customers, orders, linesPerOrder }),
      insert: 'streamed directly during generation (no separate insert step)',
      totalTimeMs: 0,
    }));

    results.totalTimeMs = Date.now() - startTime;
    etlLogger.info({ stage: 'bulk-pipeline-complete', durationMs: results.totalTimeMs }, 'Bulk pipeline completed');
    
    res.json({ success: true, message: 'Bulk pipeline completed', details: results });
  },
};
