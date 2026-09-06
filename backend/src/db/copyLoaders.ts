/**
 * High-throughput bulk loading via the PostgreSQL COPY protocol.
 *
 * Thin orchestration over `db/copy/*`:
 * - `encodeCopyLine` – row → COPY text line
 * - `staging` – temp-table lifecycle
 * - `dimensions` – FK auto-provisioning
 * - `merge` – staging → real table
 * - `columns` – memoized column lookup (re-exported for compat)
 *
 * @module db/copyLoaders
 */
import { once } from 'events';
import { Readable } from 'stream';
import pool from './pool.js';
import { quoteIdentifier, assertSafeIdentifiers } from './identifiers.js';
import { dbLogger } from '../lib/logger.js';
import { encodeCopyLine, countCopyLines } from './copy/encodeCopyLine.js';
import { tempTableName, createStagingTable } from './copy/staging.js';
import { provisionDimensionsFromStaging } from './copy/dimensions.js';
import { mergeStagingDoNothing, mergeStagingUpsert } from './copy/merge.js';
import { ensureOrderCustomerSeq } from './ensureSequences.js';

/**
 * Best-effort sequence reheal after an `ordre` bulk load.
 *
 * ETL imports carry explicit historical `ordrenr` values that can overtake
 * `ordre_customer_seq` (used by nextval for customer-placed orders).
 * Fire-and-forget: never throws, never fails the load, never touches data.
 */
function rehealSequenceAfterOrdreLoad(context: string): void {
  ensureOrderCustomerSeq().then(
    (status) => {
      if (status !== 'ok') {
        dbLogger.warn({ status, context }, 'ordre_customer_seq reheal skipped after ordre load');
      }
    },
    (err) => {
      dbLogger.warn({ err, context }, 'ordre_customer_seq reheal failed after ordre load (best-effort)');
    },
  );
}

export { getTableColumns, clearTableColumnsCache } from './copy/columns.js';
import { getTableColumns } from './copy/columns.js';

/**
 * High-throughput insert using the PostgreSQL `COPY` protocol.
 *
 * 5–10x faster than multi-value INSERT for large datasets.
 * When `onConflict` is `'nothing'`, data is first COPY-ed into a
 * temporary table, then merged into the real table with
 * `ON CONFLICT DO NOTHING`.
 *
 * **Warning:** `tableName` and `columns` are interpolated directly –
 * ensure they are trusted identifiers. Rows are converted to
 * tab-separated text and streamed in 50 000-row chunks to limit
 * memory pressure.
 *
 * @param tableName  - Target table (trusted identifier)
 * @param columns    - Column names to populate (trusted identifiers)
 * @param rows       - Array of value-arrays, one per row
 * @param onConflict - Conflict strategy: `'nothing'` (default) or `'error'`
 * @returns Number of rows actually inserted
 */
export const bulkCopy = async (
  tableName: string,
  columns: string[],
  rows: unknown[][],
  onConflict: 'nothing' | 'error' = 'nothing',
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    const copyStreams = await import('pg-copy-streams');

    // Use a temp table for ON CONFLICT DO NOTHING support
    const tempTable = tempTableName(tableName);

    // Start transaction to keep temp table alive
    await client.query('BEGIN');

    if (onConflict === 'nothing') {
      await createStagingTable(client, tableName, tempTable, columns);
    }

    const targetTable = onConflict === 'nothing' ? tempTable : tableName;

    const stream = client.query(
      copyStreams.from(`COPY ${targetTable} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text, NULL '\\N')`),
    );

    const copyResult = await new Promise<number>((resolve, reject) => {
      stream.on('error', (err: Error) => {
        reject(err);
      });

      stream.on('finish', async () => {
        try {
          if (onConflict === 'nothing') {
            // Insert from temp to real table with ON CONFLICT DO NOTHING
            resolve(await mergeStagingDoNothing(client, tableName, tempTable, columns));
          } else {
            resolve(rows.length);
          }
        } catch (err) {
          reject(err);
        }
      });

      // Stream rows to the COPY stream one line at a time to keep peak
      // memory flat and honor backpressure.
      void (async () => {
        try {
          for (let i = 0; i < rows.length; i++) {
            const line = encodeCopyLine(rows[i]);
            if (!stream.write(line)) {
              await once(stream, 'drain');
            }
          }

          stream.end();
        } catch (err) {
          reject(err);
        }
      })();
    });

    await client.query('COMMIT');
    if (tableName === 'ordre') {
      rehealSequenceAfterOrdreLoad('bulkCopy');
    }
    return copyResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export interface CopyFromLineStreamOptions {
  onConflict?: 'nothing' | 'error' | 'upsert';
  /** For upsert: unique key columns (e.g. ['ordrenr']). */
  upsertKeyColumns?: string[];
  /** For upsert: columns to update when conflict (default: all non-key columns). */
  upsertUpdateColumns?: string[];
  /** Called periodically with number of rows streamed so far. */
  onProgress?: (rowsStreamed: number) => void;
  progressInterval?: number;
  /** If set, log warning when heap (MB) exceeds this. */
  heapWarnMb?: number;
  /** If set, abort COPY when heap (MB) exceeds this (failed_heap_guard). */
  heapAbortMb?: number;
  /**
   * Awaited after staging COPY completes and before dimension provisioning /
   * the final merge / commit. Use to sequence FK-dependent tables when
   * multiple COPY pipelines run concurrently (e.g. await the ordre commit
   * before merging ordrelinje).
   */
  beforeFinalInsert?: () => Promise<void>;
  /**
   * Set to true once the first source chunk has been written to the COPY
   * stream. Callers use this to decide whether a retry is safe: once any
   * data has been pulled from (and consumed) the source stream, retrying
   * with the same source would silently skip rows.
   */
  streamProbe?: { streamedAny: boolean };
}

/**
 * Stream pre-formatted COPY lines into PostgreSQL COPY STDIN.
 *
 * This is a stream-first primitive for large ETL jobs where data is produced
 * incrementally (CSV/JSON/API adapters) and should not be fully buffered in memory.
 * Respects backpressure when source is a Readable.
 */
export const copyFromLineStream = async (
  tableName: string,
  columns: string[],
  source: AsyncIterable<string> | Readable,
  onConflict: 'nothing' | 'error' | 'upsert' = 'nothing',
  options: CopyFromLineStreamOptions = {},
): Promise<number> => {
  const { onProgress, progressInterval = 5000, upsertKeyColumns, upsertUpdateColumns } = options;
  const client = await pool.connect();
  let streamedRows = 0;
  let lastProgressEmit = 0;
  try {
    const copyStreams = await import('pg-copy-streams');
    const tempTable = tempTableName(tableName);

    await client.query('BEGIN');

    let validColSet = new Set<string>();
    if (onConflict === 'nothing' || onConflict === 'upsert') {
      validColSet = await createStagingTable(client, tableName, tempTable, columns);
    } else {
      // Direct COPY path (no staging table): still validate identifiers
      validColSet = await getTableColumns(tableName);
      assertSafeIdentifiers('columns', columns, validColSet);
    }
    const targetTable = onConflict === 'nothing' || onConflict === 'upsert' ? tempTable : tableName;
    const quotedColumns = columns.map(quoteIdentifier).join(', ');
    const copyStream = client.query(
      copyStreams.from(`COPY ${targetTable} (${quotedColumns}) FROM STDIN WITH (FORMAT text, NULL '\\N')`),
    );

    await new Promise<void>((resolve, reject) => {
      copyStream.once('error', reject);
      copyStream.once('finish', () => resolve());

      const heapAbortMb =
        options.heapAbortMb ??
        (() => {
          const v = process.env.ETL_HEAP_ABORT_MB;
          const n = v ? Number(v) : NaN;
          return Number.isFinite(n) ? n : undefined;
        })();
      const heapWarnMb =
        options.heapWarnMb ??
        (() => {
          const v = process.env.ETL_HEAP_WARN_MB;
          const n = v ? Number(v) : NaN;
          return Number.isFinite(n) ? n : undefined;
        })();

      void (async () => {
        try {
          const iterator: AsyncIterable<string> = source instanceof Readable ? source : source;
          for await (const chunk of iterator) {
            if (options.streamProbe) options.streamProbe.streamedAny = true;
            if (!copyStream.write(chunk)) {
              await once(copyStream, 'drain');
            }
            streamedRows += countCopyLines(chunk);
            if (progressInterval > 0 && streamedRows - lastProgressEmit >= progressInterval) {
              lastProgressEmit = streamedRows;
              if (onProgress) onProgress(streamedRows);
              if (heapWarnMb !== undefined || heapAbortMb !== undefined) {
                const heapUsedMb = process.memoryUsage().heapUsed / (1024 * 1024);
                if (heapWarnMb !== undefined && heapUsedMb >= heapWarnMb) {
                  dbLogger.warn(
                    { heapUsedMB: heapUsedMb, threshold: heapWarnMb, streamedRows },
                    'ETL heap above warning threshold',
                  );
                }
                if (heapAbortMb !== undefined && heapUsedMb >= heapAbortMb) {
                  copyStream.end();
                  reject(
                    new Error(
                      `Heap limit exceeded (failed_heap_guard): ${heapUsedMb.toFixed(1)} MB >= ${heapAbortMb} MB`,
                    ),
                  );
                  return;
                }
              }
            }
          }
          if (onProgress && lastProgressEmit !== streamedRows) {
            onProgress(streamedRows);
          }
          copyStream.end();
        } catch (error) {
          reject(error);
        }
      })();
    });

    if (onConflict === 'nothing' || onConflict === 'upsert') {
      // Allow callers to sequence FK-dependent merges (e.g. ordre before ordrelinje).
      if (options.beforeFinalInsert) {
        await options.beforeFinalInsert();
      }
      // 1. Auto-provision missing dimensions from the staging table
      // This ensures foreign key constraints are met before the final insert.
      await provisionDimensionsFromStaging(client, tempTable, columns);

      // 2. Final insert from staging to real table
      if (onConflict === 'upsert') {
        if (!upsertKeyColumns?.length) {
          await client.query('ROLLBACK');
          throw new Error('upsert requires upsertKeyColumns');
        }
        const inserted = await mergeStagingUpsert(
          client,
          tableName,
          tempTable,
          columns,
          validColSet,
          upsertKeyColumns,
          upsertUpdateColumns,
        );
        await client.query('COMMIT');
        if (tableName === 'ordre') {
          rehealSequenceAfterOrdreLoad('copyFromLineStream:upsert');
        }
        return inserted;
      }

      const inserted = await mergeStagingDoNothing(client, tableName, tempTable, columns);
      await client.query('COMMIT');
      if (tableName === 'ordre') {
        rehealSequenceAfterOrdreLoad('copyFromLineStream');
      }
      return inserted;
    }

    await client.query('COMMIT');
    if (tableName === 'ordre') {
      rehealSequenceAfterOrdreLoad('copyFromLineStream');
    }
    return streamedRows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
