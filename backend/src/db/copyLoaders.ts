/**
 * High-throughput bulk loading via the PostgreSQL COPY protocol.
 *
 * @module db/copyLoaders
 */
import { once } from 'events';
import { Readable } from 'stream';
import pool from './pool.js';
import { quoteIdentifier, assertSafeIdentifiers } from './identifiers.js';
import { dbLogger } from '../lib/logger.js';

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
  rows: any[][],
  onConflict: 'nothing' | 'error' = 'nothing'
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    const copyStreams = await import('pg-copy-streams');

    // Use a temp table for ON CONFLICT DO NOTHING support
    const tempTable = `temp_${tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Start transaction to keep temp table alive
    await client.query('BEGIN');

    if (onConflict === 'nothing') {
      // Create temp table with same structure (no constraints to speed up COPY)
      // EXCEPT for SERIAL columns which should be excluded from the COPY if not provided
      await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);

      // If the table has an 'id' column that is a serial, we might need to handle it
      // For the users table, the 'id' column is SERIAL and NOT NULL.
      // When we CREATE TEMP TABLE ... LIKE ..., the NOT NULL constraint is copied.
      // If we don't provide 'id' in the COPY, it fails.
      // Let's remove the NOT NULL constraint from the temp table for the columns we are NOT copying
      // Parameterized lookup – never interpolate tableName into SQL text
      const allCols = [...(await getTableColumns(tableName))];
      const validColSet = new Set<string>(allCols);
      assertSafeIdentifiers('columns', columns, validColSet);
      const missingCols = allCols.filter((c: string) => !columns.includes(c));

      for (const col of missingCols) {
        await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${quoteIdentifier(col)} DROP NOT NULL`);
      }
    }

    const targetTable = onConflict === 'nothing' ? tempTable : tableName;

    const stream = client.query(
      copyStreams.from(`COPY ${targetTable} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
    );

    const copyResult = await new Promise<number>((resolve, reject) => {
      stream.on('error', (err: Error) => {
        reject(err);
      });

      stream.on('finish', async () => {
        try {
          if (onConflict === 'nothing') {
            // Insert from temp to real table with ON CONFLICT DO NOTHING
            const result = await client.query(`
              INSERT INTO ${tableName} (${columns.join(', ')})
              SELECT ${columns.join(', ')} FROM ${tempTable}
              ON CONFLICT DO NOTHING
            `);
            resolve(result.rowCount || 0);
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
            const row = rows[i];
            let line = '';
            for (let j = 0; j < row.length; j++) {
              if (j > 0) line += '\t';
              const val: any = row[j];
              if (val === null || val === undefined) {
                line += '\\N';
                continue;
              }
              // Fast path: skip 4 regex replaces when no special chars present.
              const str = typeof val === 'string' ? val : String(val);
              if (/[\t\n\r\\]/.test(str)) {
                line += str.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
              } else {
                line += str;
              }
            }
            line += '\n';

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
    return copyResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Count COPY text lines in a chunk (each line is one row).
 */
function countCopyLines(chunk: string): number {
  if (!chunk || typeof chunk !== 'string') return 0;
  const matches = chunk.match(/\n/g);
  return matches ? matches.length : (chunk.trim() ? 1 : 0);
}

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
  options: CopyFromLineStreamOptions = {}
): Promise<number> => {
  const { onProgress, progressInterval = 5000, upsertKeyColumns, upsertUpdateColumns } = options;
  const client = await pool.connect();
  let streamedRows = 0;
  let lastProgressEmit = 0;
  try {
    const copyStreams = await import('pg-copy-streams');
    const tempTable = `temp_${tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await client.query('BEGIN');

    let validColSet = new Set<string>();
    if (onConflict === 'nothing' || onConflict === 'upsert') {
      await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);
      validColSet = await getTableColumns(tableName);
      assertSafeIdentifiers('columns', columns, validColSet);
      const missingCols = [...validColSet].filter((c: string) => !columns.includes(c));
      for (const col of missingCols) {
        await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${quoteIdentifier(col)} DROP NOT NULL`);
      }
    } else {
      // Direct COPY path (no staging table): still validate identifiers
      validColSet = await getTableColumns(tableName);
      assertSafeIdentifiers('columns', columns, validColSet);
    }
    const targetTable = onConflict === 'nothing' || onConflict === 'upsert' ? tempTable : tableName;
    const quotedColumns = columns.map(quoteIdentifier).join(', ');
    const copyStream = client.query(
      copyStreams.from(`COPY ${targetTable} (${quotedColumns}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
    );

    await new Promise<void>((resolve, reject) => {
      copyStream.once('error', reject);
      copyStream.once('finish', () => resolve());

      const heapAbortMb = options.heapAbortMb ?? (() => {
        const v = process.env.ETL_HEAP_ABORT_MB;
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) ? n : undefined;
      })();
      const heapWarnMb = options.heapWarnMb ?? (() => {
        const v = process.env.ETL_HEAP_WARN_MB;
        const n = v ? Number(v) : NaN;
        return Number.isFinite(n) ? n : undefined;
      })();

      void (async () => {
        try {
          const iterator: AsyncIterable<string> =
            source instanceof Readable ? source : source;
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
                  dbLogger.warn({ heapUsedMB: heapUsedMb, threshold: heapWarnMb, streamedRows }, 'ETL heap above warning threshold');
                }
                if (heapAbortMb !== undefined && heapUsedMb >= heapAbortMb) {
                  copyStream.end();
                  reject(new Error(`Heap limit exceeded (failed_heap_guard): ${heapUsedMb.toFixed(1)} MB >= ${heapAbortMb} MB`));
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
      if (columns.includes('kundenr')) {
        await client.query(`
          INSERT INTO public.kunde (kundenr, kundenavn)
          SELECT DISTINCT kundenr, 'Auto-generert' FROM ${tempTable}
          WHERE kundenr IS NOT NULL
          ON CONFLICT (kundenr) DO NOTHING
        `);
      }
      if (columns.includes('firmaid')) {
        await client.query(`
          INSERT INTO public.firma (firmaid, firmanavn)
          SELECT DISTINCT firmaid, 'Firma ' || firmaid FROM ${tempTable}
          WHERE firmaid IS NOT NULL
          ON CONFLICT (firmaid) DO NOTHING
        `);
      }
      if (columns.includes('valutaid')) {
        await client.query(`
          INSERT INTO public.valuta (valutaid)
          SELECT DISTINCT valutaid FROM ${tempTable}
          WHERE valutaid IS NOT NULL
          ON CONFLICT (valutaid) DO NOTHING
        `);
      }
      if (columns.includes('varekode')) {
        await client.query(`
          INSERT INTO public.vare (varekode, varenavn)
          SELECT DISTINCT varekode, 'Produkt ' || varekode FROM ${tempTable}
          WHERE varekode IS NOT NULL
          ON CONFLICT (varekode) DO NOTHING
        `);
      }
      if (columns.includes('lagernavn') && columns.includes('firmaid')) {
        await client.query(`
          INSERT INTO public.lager (lagernavn, firmaid)
          SELECT DISTINCT lagernavn, firmaid FROM ${tempTable}
          WHERE lagernavn IS NOT NULL AND firmaid IS NOT NULL
          ON CONFLICT (lagernavn, firmaid) DO NOTHING
        `);
      }

      // 2. Final insert from staging to real table
      if (onConflict === 'upsert') {
        const keyCols = upsertKeyColumns?.length ? upsertKeyColumns : [];
        if (keyCols.length === 0) {
          await client.query('ROLLBACK');
          throw new Error('upsert requires upsertKeyColumns');
        }
        // Request-supplied identifiers must be real columns of the target table
        assertSafeIdentifiers('upsert key column', keyCols, validColSet);
        const updateCols =
          upsertUpdateColumns?.length
            ? upsertUpdateColumns
            : columns.filter((c) => !keyCols.includes(c));
        assertSafeIdentifiers('upsert update column', updateCols, validColSet);
        const setClause =
          updateCols.length > 0
            ? updateCols.map((c) => `${quoteIdentifier(c)} = EXCLUDED.${quoteIdentifier(c)}`).join(', ')
            : null;
        const conflictClause = `ON CONFLICT (${keyCols.map(quoteIdentifier).join(', ')})`;
        const doUpdate = setClause
          ? `DO UPDATE SET ${setClause}`
          : 'DO NOTHING';
        const result = await client.query(`
          INSERT INTO ${tableName} (${columns.join(', ')})
          SELECT ${columns.join(', ')} FROM ${tempTable}
          ${conflictClause} ${doUpdate}
        `);
        await client.query('COMMIT');
        return result.rowCount || 0;
      }

      const result = await client.query(`
        INSERT INTO ${tableName} (${columns.join(', ')})
        SELECT ${columns.join(', ')} FROM ${tempTable}
        ON CONFLICT DO NOTHING
      `);
      await client.query('COMMIT');
      return result.rowCount || 0;
    }

    await client.query('COMMIT');
    return streamedRows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Returns the set of column names for a table in the public schema.
 * Results are memoized briefly to avoid an information_schema round-trip
 * on every COPY call in hot ETL loops.
 */
const tableColumnCache = new Map<string, { cols: Set<string>; expiresAt: number }>();
const TABLE_COLUMN_CACHE_TTL_MS = 60_000;

export const getTableColumns = async (tableName: string): Promise<Set<string>> => {
  const cached = tableColumnCache.get(tableName);
  if (cached && cached.expiresAt > Date.now()) return cached.cols;
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    ['public', tableName]
  );
  const cols = new Set(result.rows.map((r: { column_name: string }) => r.column_name));
  tableColumnCache.set(tableName, { cols, expiresAt: Date.now() + TABLE_COLUMN_CACHE_TTL_MS });
  return cols;
};

/** Test hook: clear the table-column memoization cache. */
export const clearTableColumnsCache = (): void => {
  tableColumnCache.clear();
};
