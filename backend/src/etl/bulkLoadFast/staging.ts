import { once } from 'events';
import type { PoolClient } from 'pg';
import { etlLogger } from '../../lib/logger.js';
import { dropBulkIndexes } from '../bulkDataController.js';
import { FACT_TABLE_FKS } from './integrity.js';
import {
  BatchStats,
  HeapGuardOptions,
  MIN_BATCH_ROWS,
  MAX_BATCH_ROWS,
  HEAP_SAMPLE_INTERVAL,
} from './shared.js';

/**
 * Stream COPY chunks (Buffer or string) into a staging table. Tracks drain count and wait time
 * for adaptive batch sizing; optionally samples heap and aborts if over heapAbortMb.
 */
export async function copyIntoStagingFromChunks(
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

/**
 * Insert from staging tables into final tables and rebuild all indexes.
 *
 * Merge is accelerated by removing everything that would otherwise be
 * maintained per-row:
 *  - secondary indexes (dropBulkIndexes + all ordre_henvisning search indexes)
 *  - FK constraints (per-row trigger checks; measured ~3x cost on this workload)
 *
 * Afterwards everything is restored: full index set (createBulkIndexes +
 * snapshotted ordre_henvisning index DDL) and the FKs re-added as NOT VALID —
 * metadata-only, so future writes are enforced without a costly table scan.
 * Data written here comes from our own generator with parents inserted in the
 * same run, so validation of existing rows adds no value.
 */
export async function migrateStagingToFinal(client: PoolClient): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
}> {
  const t0 = Date.now();

  // Snapshot ordre_henvisning secondary-index DDL so we can restore exactly
  // what existed (btree + trgm search indexes) after the load.
  const henvIndexes = await client.query(`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'ordre_henvisning'
      AND indexname <> 'ordre_henvisning_pkey'
  `);
  const henvIndexDefs: string[] = henvIndexes.rows.map((r: { indexdef: string }) => r.indexdef);

  await dropBulkIndexes();
  await client.query(`
    DO $$ DECLARE r RECORD; BEGIN
      FOR r IN SELECT indexname FROM pg_indexes
               WHERE schemaname = 'public' AND tablename = 'ordre_henvisning'
                 AND indexname <> 'ordre_henvisning_pkey'
      LOOP EXECUTE 'DROP INDEX IF EXISTS public.' || quote_ident(r.indexname); END LOOP;
    END $$;
  `);
  for (const [table, fk] of FACT_TABLE_FKS) {
    await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${fk}`);
  }
  const tDrop = Date.now();

  // Wrap all INSERTs + TRUNCATE in a transaction so they are atomic.
  // ROLLBACK on failure is mandatory: without it the connection returns to
  // the pool stuck in "aborted transaction" state and every later query on
  // that client fails with InFailedSqlTransaction.
  let ordersResult: { rowCount: number | null };
  let linesResult: { rowCount: number | null };
  let refResult: { rowCount: number | null };
  let timings: { insertOrdreMs: number; insertLinjeMs: number; insertHenvisningMs: number; commitMs: number };

  await client.query('BEGIN');
  try {
    ordersResult = await client.query(`
      INSERT INTO ordre (ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum)
      SELECT ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum
      FROM staging_ordre
      ON CONFLICT (ordrenr) DO NOTHING
      RETURNING 1
    `);
    const t1 = Date.now();

    linesResult = await client.query(`
      INSERT INTO ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
      SELECT linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus
      FROM staging_ordrelinje
      ON CONFLICT (linjenr, ordrenr) DO NOTHING
      RETURNING 1
    `);
    const t2 = Date.now();

    refResult = await client.query(`
      INSERT INTO ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5)
      SELECT ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5
      FROM staging_ordre_henvisning
      ON CONFLICT (ordrenr, linjenr) DO NOTHING
      RETURNING 1
    `);
    const t3 = Date.now();

    // Drop staging data now that migration is complete (still inside the transaction).
    await client.query('TRUNCATE TABLE staging_ordre, staging_ordrelinje, staging_ordre_henvisning');

    await client.query('COMMIT');

    timings = {
      insertOrdreMs: t1 - tDrop,
      insertLinjeMs: t2 - t1,
      insertHenvisningMs: t3 - t2,
      commitMs: Date.now() - t3,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }

  // Restore phase. Plain index builds (not CONCURRENTLY): exclusive bulk job,
  // no concurrent writers to wait for.
  const { createBulkIndexes } = await import('../bulkData/indexes.js');
  await createBulkIndexes();
  for (const def of henvIndexDefs) {
    await client.query(def.replace(/CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS '));
  }
  // Re-add FKs as NOT VALID via the shared integrity list.
  for (const [table, fk, ddl] of FACT_TABLE_FKS) {
    await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${fk} ${ddl} NOT VALID`);
  }
  const t5 = Date.now();

  etlLogger.info(
    {
      stage: 'migrate-timing',
      dropMs: tDrop - t0,
      ...timings,
      rebuildMs: t5 - tDrop - timings.insertOrdreMs - timings.insertLinjeMs - timings.insertHenvisningMs - timings.commitMs,
    },
    'Staging migration timing'
  );

  return {
    ordrer: ordersResult.rowCount || 0,
    ordrelinjer: linesResult.rowCount || 0,
    ordre_henvisninger: refResult.rowCount || 0,
  };
}
