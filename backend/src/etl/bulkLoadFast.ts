import { once } from 'events';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { query, getClient } from '../db/index.js';
import { etlLogger } from '../lib/logger.js';
import { getDimensionData, ensureDimensionData, dropBulkIndexes } from './bulkDataController.js';
import { registerJob, completeJob, failJob } from './jobRegistry.js';
import { recordBulkFastRun } from './etlMetrics.js';
import {
  takeBuffer,
  returnBuffer,
  writeCopyValue,
  writeCopyField,
  writeCopyRowEnd,
  COPY_BUFFER_SIZE,
} from './copyBufferEncoder.js';

type BulkFastConfig = {
  totalOrders: number;
  customers?: number;
  linesPerOrder?: number;
  /** If set, job is registered for progress and heap-abort failure. */
  jobId?: string;
};

type TableMetrics = {
  rows: number;
};

/** Adaptive batch sizing: updated by copyIntoStagingFromText based on drain backpressure. */
export type BatchStats = {
  rowsPerBatch: number;
  drainCount: number;
  drainWaitMs: number;
  chunksWritten: number;
};

const DEFAULT_WORK_MEM = '256MB';
const DEFAULT_MAINT_WORK_MEM = '1GB';
const MIN_BATCH_ROWS = 1000;
const MAX_BATCH_ROWS = 10000;
const INITIAL_ROWS_PER_BATCH = 1000;
/** Reserve bytes at end of buffer so we never overflow (max row ~300 bytes). */
const BUFFER_RESERVE = 512;
/** Sample heap every N chunks to limit overhead. */
const HEAP_SAMPLE_INTERVAL = 20;

function getEnvNumber(name: string): number | undefined {
  const v = process.env[name];
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Options for heap monitoring and abort during COPY. */
export type HeapGuardOptions = {
  heapWarnMb?: number;
  heapAbortMb?: number;
  jobId?: string;
  stage?: string;
  /** Updated with max heap observed (for metrics). */
  maxHeapUsedMb?: { value: number };
};

const ORDRE_COLS = ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'];
const ORDRELINJE_COLS = ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'];
const HENVISNING_COLS = ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'];

/**
 * Create unlogged staging tables for ordre, ordrelinje, ordre_henvisning.
 * Uses LIKE ... INCLUDING DEFAULTS EXCLUDING CONSTRAINTS to avoid FK/PK overhead during COPY.
 */
async function createUnloggedStagingTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordre (
      LIKE public.ordre INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordrelinje (
      LIKE public.ordrelinje INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);
  await client.query(`
    CREATE UNLOGGED TABLE IF NOT EXISTS staging_ordre_henvisning (
      LIKE public.ordre_henvisning INCLUDING DEFAULTS EXCLUDING CONSTRAINTS
    )
  `);

  // Disable autovacuum during the high-throughput load; tables are staging-only.
  await client.query(`ALTER TABLE staging_ordre SET (autovacuum_enabled = false)`);
  await client.query(`ALTER TABLE staging_ordrelinje SET (autovacuum_enabled = false)`);
  await client.query(`ALTER TABLE staging_ordre_henvisning SET (autovacuum_enabled = false)`);

  // Ensure they start empty for this run.
  await client.query(`TRUNCATE TABLE staging_ordre, staging_ordrelinje, staging_ordre_henvisning`);
}

/** Tune work_mem / maintenance_work_mem for this session only. */
async function setSessionWorkMem(client: PoolClient): Promise<void> {
  await client.query(`SET work_mem = '${DEFAULT_WORK_MEM}'`);
  await client.query(`SET maintenance_work_mem = '${DEFAULT_MAINT_WORK_MEM}'`);
}

/** Async generator yielding COPY buffer chunks for ordre table (buffer pool, no per-row arrays). */
async function* generateOrdreCopyBuffers(
  totalOrders: number,
  customers: number,
  metrics: TableMetrics,
  batchStats: BatchStats
): AsyncGenerator<Buffer> {
  const buf = takeBuffer();
  let offset = 0;
  let rowsInBatch = 0;
  try {
    for (let i = 1; i <= totalOrders; i++) {
      const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
      const firmaid = (i % 5) + 1;
      const ordrenr = 10000 + i;
      const year = 2024 + (i % 3);
      const month = (i % 12) + 1;
      const day = (i % 28) + 1;
      const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const kundeordreref = `PO-${year}-${String(ordrenr).padStart(6, '0')}`;
      const kunderef = 'Auto Bulk Kunde';
      const lagernavn = 'Hovedkontor Oslo Hovedlager';
      const valuta = 'NOK';
      const sum = 0;

      offset = writeCopyValue(buf, offset, ordrenr);
      offset = writeCopyField(buf, offset, dato);
      offset = writeCopyField(buf, offset, kundenr);
      offset = writeCopyField(buf, offset, kundeordreref);
      offset = writeCopyField(buf, offset, kunderef);
      offset = writeCopyField(buf, offset, firmaid);
      offset = writeCopyField(buf, offset, lagernavn);
      offset = writeCopyField(buf, offset, valuta);
      offset = writeCopyField(buf, offset, sum);
      offset = writeCopyRowEnd(buf, offset);

      metrics.rows += 1;
      rowsInBatch += 1;

      if (rowsInBatch >= batchStats.rowsPerBatch || offset > COPY_BUFFER_SIZE - BUFFER_RESERVE) {
        yield Buffer.from(buf.subarray(0, offset));
        offset = 0;
        rowsInBatch = 0;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (offset > 0) {
      yield Buffer.from(buf.subarray(0, offset));
    }
  } finally {
    returnBuffer(buf);
  }
}

/** Async generator yielding COPY buffer chunks for ordrelinje table. */
async function* generateOrdrelinjeCopyBuffers(
  totalOrders: number,
  customers: number,
  linesPerOrder: number,
  metrics: TableMetrics,
  batchStats: BatchStats
): AsyncGenerator<Buffer> {
  const buf = takeBuffer();
  let offset = 0;
  let rowsInBatch = 0;
  try {
    for (let i = 1; i <= totalOrders; i++) {
      const ordrenr = 10000 + i;
      const numLines = ((i * 7) % linesPerOrder) + 1;

      for (let j = 1; j <= numLines; j++) {
        const varekode = `V${String((i * j) % 500 + 1).padStart(5, '0')}`;
        const antall = ((i + j) % 50) + 1;
        const nettpris = ((i * 11 + j) % 5000) + 50;
        const linjesum = antall * nettpris;

        offset = writeCopyValue(buf, offset, j);
        offset = writeCopyField(buf, offset, ordrenr);
        offset = writeCopyField(buf, offset, varekode);
        offset = writeCopyField(buf, offset, antall);
        offset = writeCopyField(buf, offset, 'stk');
        offset = writeCopyField(buf, offset, nettpris);
        offset = writeCopyField(buf, offset, linjesum);
        offset = writeCopyField(buf, offset, 1);
        offset = writeCopyRowEnd(buf, offset);

        metrics.rows += 1;
        rowsInBatch += 1;

        if (rowsInBatch >= batchStats.rowsPerBatch || offset > COPY_BUFFER_SIZE - BUFFER_RESERVE) {
          yield Buffer.from(buf.subarray(0, offset));
          offset = 0;
          rowsInBatch = 0;
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
    if (offset > 0) {
      yield Buffer.from(buf.subarray(0, offset));
    }
  } finally {
    returnBuffer(buf);
  }
}

/** Async generator yielding COPY buffer chunks for ordre_henvisning table. */
async function* generateHenvisningCopyBuffers(
  totalOrders: number,
  customers: number,
  linesPerOrder: number,
  metrics: TableMetrics,
  batchStats: BatchStats
): AsyncGenerator<Buffer> {
  const PROSJEKTER = [
    'Nordsjøen Vedlikehold', 'Mongstad Oppgradering', 'Sverdrup Fase 2',
    'Kårstø Drift', 'Snøhvit LNG', 'Martin Linge', 'Troll A',
    'Hammerfest LNG', 'Oseberg Sør', 'Gullfaks Subsea',
    'Åsgard Turnaround', 'Valemon Drift', 'Gina Krog', 'Edvard Grieg',
    'Sleipner Vest', 'Statfjord C', 'Njord Bravo', 'Heidrun TLP',
  ];
  const AVDELINGER = ['Innkjøp', 'Vedlikehold', 'Drift', 'Prosjekt', 'Lager', 'HMS', 'Mek. Verksted', 'Elektro'];

  const buf = takeBuffer();
  let offset = 0;
  let rowsInBatch = 0;
  try {
    for (let i = 1; i <= totalOrders; i++) {
      const ordrenr = 10000 + i;
      const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
      const numLines = ((i * 7) % linesPerOrder) + 1;

      for (let j = 1; j <= numLines; j++) {
        if (i % 5 !== 0 || j <= 2) {
          const henvisning1 = PROSJEKTER[(i + j) % PROSJEKTER.length];
          const henvisning2 = `${AVDELINGER[(i + j) % AVDELINGER.length]}-${kundenr}`;
          const henvisning3 = `WO-${10000 + ((i * 7 + j * 3) % 90000)}`;
          const henvisning4 = (i + j) % 3 === 0 ? `TAG-${String.fromCharCode(65 + (i % 26))}${(i * j) % 999 + 1}` : null;
          const henvisning5 = (i + j) % 4 === 0 ? `Kostnadssted ${1000 + (i % 9000)}` : null;

          offset = writeCopyValue(buf, offset, ordrenr);
          offset = writeCopyField(buf, offset, j);
          offset = writeCopyField(buf, offset, henvisning1);
          offset = writeCopyField(buf, offset, henvisning2);
          offset = writeCopyField(buf, offset, henvisning3);
          offset = writeCopyField(buf, offset, henvisning4);
          offset = writeCopyField(buf, offset, henvisning5);
          offset = writeCopyRowEnd(buf, offset);

          metrics.rows += 1;
          rowsInBatch += 1;

          if (rowsInBatch >= batchStats.rowsPerBatch || offset > COPY_BUFFER_SIZE - BUFFER_RESERVE) {
            yield Buffer.from(buf.subarray(0, offset));
            offset = 0;
            rowsInBatch = 0;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
    }
    if (offset > 0) {
      yield Buffer.from(buf.subarray(0, offset));
    }
  } finally {
    returnBuffer(buf);
  }
}

/**
 * Stream COPY chunks (Buffer or string) into a staging table. Tracks drain count and wait time
 * for adaptive batch sizing; optionally samples heap and aborts if over heapAbortMb.
 */
async function copyIntoStagingFromChunks(
  client: PoolClient,
  tableName: string,
  columns: string[],
  source: AsyncIterable<string | Buffer>,
  batchStats: BatchStats,
  heapOptions?: HeapGuardOptions
): Promise<void> {
  const copyStreams = await import('pg-copy-streams');
  const sql = `COPY ${tableName} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text, NULL '\\N')`;
  const copyStream = client.query(copyStreams.from(sql));

  let drainCount = 0;
  let drainWaitMs = 0;
  let chunksWritten = 0;

  await new Promise<void>((resolve, reject) => {
    copyStream.once('error', reject);
    copyStream.once('finish', () => resolve());

    void (async () => {
      try {
        for await (const chunk of source) {
          const ok = copyStream.write(chunk);
          chunksWritten += 1;
          if (!ok) {
            const t0 = Date.now();
            await once(copyStream, 'drain');
            drainCount += 1;
            drainWaitMs += Date.now() - t0;
          }

          if (heapOptions && (heapOptions.heapWarnMb !== undefined || heapOptions.heapAbortMb !== undefined)) {
            if (chunksWritten % HEAP_SAMPLE_INTERVAL === 0) {
              const heapUsedMb = process.memoryUsage().heapUsed / (1024 * 1024);
              if (heapOptions.maxHeapUsedMb !== undefined && heapUsedMb > heapOptions.maxHeapUsedMb.value) {
                heapOptions.maxHeapUsedMb.value = heapUsedMb;
              }
              etlLogger.debug(
                { stage: heapOptions.stage ?? 'copy', heapUsedMB: Math.round(heapUsedMb * 100) / 100, chunksWritten },
                'Heap sample'
              );
              if (heapOptions.heapWarnMb !== undefined && heapUsedMb >= heapOptions.heapWarnMb) {
                etlLogger.warn(
                  { stage: heapOptions.stage, heapUsedMB: heapUsedMb, threshold: heapOptions.heapWarnMb },
                  'Heap usage above warning threshold'
                );
              }
              if (heapOptions.heapAbortMb !== undefined && heapUsedMb >= heapOptions.heapAbortMb) {
                copyStream.end();
                reject(new Error(`Heap limit exceeded (failed_heap_guard): ${heapUsedMb.toFixed(1)} MB >= ${heapOptions.heapAbortMb} MB`));
                return;
              }
            }
          }
        }
        copyStream.end();
      } catch (err) {
        reject(err);
      }
    })();
  });

  batchStats.drainCount += drainCount;
  batchStats.drainWaitMs += drainWaitMs;
  batchStats.chunksWritten += chunksWritten;

  // Adaptive batch sizing for next table/run
  if (drainCount === 0 && chunksWritten > 5 && batchStats.rowsPerBatch < MAX_BATCH_ROWS) {
    batchStats.rowsPerBatch = Math.min(batchStats.rowsPerBatch + 1000, MAX_BATCH_ROWS);
  } else if (drainCount > 10 && batchStats.rowsPerBatch > MIN_BATCH_ROWS) {
    batchStats.rowsPerBatch = Math.max(batchStats.rowsPerBatch - 1000, MIN_BATCH_ROWS);
  }

  etlLogger.debug(
    {
      tableName,
      chunksWritten,
      drainCount,
      drainWaitMs,
      rowsPerBatch: batchStats.rowsPerBatch,
    },
    'COPY chunk stats'
  );
}

/** Insert from staging tables into final tables and build indexes concurrently. */
async function migrateStagingToFinal(client: PoolClient): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
}> {
  // Drop existing indexes to speed up massive INSERT; they will be rebuilt concurrently.
  await dropBulkIndexes();

  // Wrap all INSERTs + TRUNCATE in a transaction so they are atomic.
  await client.query('BEGIN');

  const ordersResult = await client.query(`
    INSERT INTO ordre (ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum)
    SELECT ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum
    FROM staging_ordre
    ON CONFLICT (ordrenr) DO NOTHING
    RETURNING 1
  `);

  const linesResult = await client.query(`
    INSERT INTO ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
    SELECT linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus
    FROM staging_ordrelinje
    ON CONFLICT (linjenr, ordrenr) DO NOTHING
    RETURNING 1
  `);

  const refResult = await client.query(`
    INSERT INTO ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5)
    SELECT ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5
    FROM staging_ordre_henvisning
    ON CONFLICT (ordrenr, linjenr) DO NOTHING
    RETURNING 1
  `);

  // Drop staging data now that migration is complete (still inside the transaction).
  await client.query('TRUNCATE TABLE staging_ordre, staging_ordrelinje, staging_ordre_henvisning');

  await client.query('COMMIT');

  // Build indexes concurrently OUTSIDE the transaction (PostgreSQL requirement).
  await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordrelinje_ordrenr ON ordrelinje(ordrenr)');
  await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordrelinje_varekode ON ordrelinje(varekode)');
  await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordre_kundenr ON ordre(kundenr)');
  await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ordre_dato ON ordre(dato)');

  return {
    ordrer: ordersResult.rowCount || 0,
    ordrelinjer: linesResult.rowCount || 0,
    ordre_henvisninger: refResult.rowCount || 0,
  };
}

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

