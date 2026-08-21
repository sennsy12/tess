import { randomUUID } from 'crypto';
import { getClient } from '../db/index.js';
import { etlLogger } from '../lib/logger.js';
import { ensureDimensionData } from './bulkDataController.js';
import { registerJob, completeJob, failJob } from './jobRegistry.js';
import { recordBulkFastRun } from './etlMetrics.js';
import {
  BulkFastConfig,
  BatchStats,
  HeapGuardOptions,
  TableMetrics,
  getEnvNumber,
  INITIAL_ROWS_PER_BATCH,
  ORDRE_COLS,
  ORDRELINJE_COLS,
  HENVISNING_COLS,
} from './bulkLoadFast/shared.js';
import { setSessionWorkMem, createUnloggedStagingTables } from './bulkLoadFast/sessionSetup.js';
import {
  generateOrdreCopyBuffers,
  generateOrdrelinjeCopyBuffers,
  generateHenvisningCopyBuffers,
} from './bulkLoadFast/generators.js';
import { copyIntoStagingFromChunks, migrateStagingToFinal } from './bulkLoadFast/staging.js';

export type { BulkFastConfig, TableMetrics };
export type { BatchStats };
export type { HeapGuardOptions };

/**
 * High-throughput bulk loader using unlogged staging tables and sequential COPY streams.
 * Target: 200k+ rows/sec with flat heap by using batched text COPY and strict backpressure.
 */
export async function runBulkLoadFast(config: BulkFastConfig): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
  jobId?: string;
  maxHeapUsedMb?: number;
}> {
  const {
    totalOrders,
    customers = 1000,
    linesPerOrder = 5,
    jobId: configJobId,
  } = config;

  const jobId = configJobId ?? randomUUID();
  const heapWarnMb = getEnvNumber('FAST_HEAP_WARN_MB');
  const heapAbortMb = getEnvNumber('FAST_HEAP_ABORT_MB');
  const maxHeapUsedMbRef = { value: 0 };

  registerJob(jobId, 'ordre', 'generator');

  const startTime = Date.now();
  const client = await getClient();

  const heapOptions: HeapGuardOptions | undefined =
    heapWarnMb !== undefined || heapAbortMb !== undefined
      ? {
          heapWarnMb,
          heapAbortMb,
          jobId,
          stage: 'bulk-fast',
          maxHeapUsedMb: maxHeapUsedMbRef,
        }
      : undefined;

  try {
    etlLogger.info(
      { stage: 'bulk-fast-start', totalOrders, customers, linesPerOrder, jobId },
      'Starting fast bulk load using unlogged staging tables and sequential COPY'
    );

    await setSessionWorkMem(client);
    await createUnloggedStagingTables(client);

    // Ensure required dimensions exist (cheap; reuses shared helper).
    await ensureDimensionData(customers);

    // Phase 2+3+4: sequential COPY per table with buffer-pool generators and adaptive backpressure.
    const batchStats: BatchStats = {
      rowsPerBatch: INITIAL_ROWS_PER_BATCH,
      drainCount: 0,
      drainWaitMs: 0,
      chunksWritten: 0,
    };

    const ordreMetrics: TableMetrics = { rows: 0 };
    await copyIntoStagingFromChunks(
      client,
      'staging_ordre',
      ORDRE_COLS,
      generateOrdreCopyBuffers(totalOrders, customers, ordreMetrics, batchStats),
      batchStats,
      heapOptions
    );

    const ordrelinjeMetrics: TableMetrics = { rows: 0 };
    await copyIntoStagingFromChunks(
      client,
      'staging_ordrelinje',
      ORDRELINJE_COLS,
      generateOrdrelinjeCopyBuffers(totalOrders, customers, linesPerOrder, ordrelinjeMetrics, batchStats),
      batchStats,
      heapOptions
    );

    const henvisningMetrics: TableMetrics = { rows: 0 };
    await copyIntoStagingFromChunks(
      client,
      'staging_ordre_henvisning',
      HENVISNING_COLS,
      generateHenvisningCopyBuffers(totalOrders, customers, linesPerOrder, henvisningMetrics, batchStats),
      batchStats,
      heapOptions
    );

    const stagingEndTime = Date.now();
    const stagingDurationMs = stagingEndTime - startTime;
    const totalChunks = batchStats.chunksWritten;
    const avgBatchDurationMs = stagingDurationMs > 0 && totalChunks > 0 ? stagingDurationMs / totalChunks : 0;
    etlLogger.info(
      {
        stage: 'bulk-fast-staging-complete',
        stagingOrdre: ordreMetrics.rows,
        stagingOrdrelinje: ordrelinjeMetrics.rows,
        stagingHenvisning: henvisningMetrics.rows,
        effectiveRowsPerBatch: batchStats.rowsPerBatch,
        totalChunks: batchStats.chunksWritten,
        drainCount: batchStats.drainCount,
        drainWaitMs: batchStats.drainWaitMs,
        avgBatchDurationMs: Math.round(avgBatchDurationMs),
      },
      'Staging COPY into unlogged tables completed'
    );

    // Phase 5: migrate from staging to final tables and build indexes concurrently.
    const migrated = await migrateStagingToFinal(client);

    const duration = Date.now() - startTime;
    const totalRows = migrated.ordrer + migrated.ordrelinjer + migrated.ordre_henvisninger;
    const rowsPerSecond = duration > 0 ? Math.round(totalRows / (duration / 1000)) : 0;

    completeJob(jobId);
    recordBulkFastRun({
      totalRows,
      insertionTimeMs: duration,
      rowsPerSecond,
      maxHeapUsedMb: maxHeapUsedMbRef.value > 0 ? maxHeapUsedMbRef.value : undefined,
      jobId,
    });
    etlLogger.info(
      {
        stage: 'bulk-fast-complete',
        totalRows,
        durationMs: duration,
        rowsPerSecond,
        stagingOrdre: ordreMetrics.rows,
        stagingOrdrelinje: ordrelinjeMetrics.rows,
        stagingHenvisning: henvisningMetrics.rows,
        maxHeapUsedMb: maxHeapUsedMbRef.value > 0 ? Math.round(maxHeapUsedMbRef.value * 100) / 100 : undefined,
      },
      'Fast bulk load pipeline completed'
    );

    return {
      ordrer: migrated.ordrer,
      ordrelinjer: migrated.ordrelinjer,
      ordre_henvisninger: migrated.ordre_henvisninger,
      totalRows,
      insertionTimeMs: duration,
      rowsPerSecond,
      jobId,
      maxHeapUsedMb: maxHeapUsedMbRef.value > 0 ? maxHeapUsedMbRef.value : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failJob(jobId, message);
    throw err;
  } finally {
    client.release();
  }
}
