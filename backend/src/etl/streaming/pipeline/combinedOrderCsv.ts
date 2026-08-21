import { once } from 'events';
import { getClient } from '../../../db/index.js';
import { quoteIdentifier, assertSafeIdentifiers } from '../../../db/identifiers.js';
import { getTableColumns } from '../../../db/copyLoaders.js';
import { etlLogger } from '../../../lib/logger.js';
import { scheduleStatisticsRefreshAfterEtl } from '../../../services/statsAggregateService.js';
import { csvRowSource } from '../sources/csvSource.js';
import {
  buildColumnPlan,
  formatCopyLine,
  normalizeRecord,
} from '../transforms.js';
import { mapRow } from './helpers.js';

export interface CombinedOrderCsvResult {
  ordreInserted: number;
  ordrelinjeInserted: number;
  attemptedRows: number;
  rejectedOrdreRows: number;
  rejectedOrdrelinjeRows: number;
}

/**
 * Provision missing dimension rows referenced by the staging table, mirroring
 * the behavior of copyFromLineStream's auto-provisioning step.
 */
async function provisionDimensions(
  client: Awaited<ReturnType<typeof getClient>>,
  tempTable: string,
  columns: string[]
): Promise<void> {
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
}

interface CopyTarget {
  tableName: string;
  columns: string[];
  tempTable: string;
}

type StagedClient = Awaited<ReturnType<typeof getClient>>;
type CopyStream = NodeJS.WritableStream & { end(cb?: () => void): void };

const drain = async (stream: CopyStream): Promise<void> => {
  await once(stream as never, 'drain');
};

/**
 * Begin a transaction, create a constraint-free temp staging table and open a
 * COPY ... FROM STDIN stream on it. The transaction stays OPEN; the caller
 * feeds the returned stream and later merges + commits.
 */
async function beginStagingCopy(
  client: StagedClient,
  target: CopyTarget
): Promise<CopyStream> {
  const { tableName, columns, tempTable } = target;
  const copyStreams = await import('pg-copy-streams');

  await client.query('BEGIN');
  await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);
  const validColSet = await getTableColumns(tableName);
  assertSafeIdentifiers(`combined-${tableName} columns`, columns, validColSet);
  // Relax NOT NULL on columns the CSV does not provide so staging stays light.
  for (const col of [...validColSet].filter((c) => !columns.includes(c))) {
    await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${quoteIdentifier(col)} DROP NOT NULL`);
  }

  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  return client.query(
    copyStreams.from(`COPY ${tempTable} (${quotedColumns}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
  );
}

/** Resolve when the COPY stream finishes (server consumed everything). */
function waitForCopyFinish(stream: CopyStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('finish', () => resolve());
  });
}

/**
 * Single-pass ingest of a combined order/order-line CSV.
 *
 * The file is read ONCE and fed into two parallel COPY streams on separate
 * connections (same proven driver-loop pattern as bulkData/streaming.ts).
 * Sequence guarantees FK safety without re-reading the file:
 *   1. both staging COPYs stream concurrently until EOF
 *   2. ordre dimensions + merge + COMMIT
 *   3. ordrelinje dimensions + merge + COMMIT (ordre now visible -> FK holds)
 *
 * Memory stays O(1): rows are mapped and streamed, never buffered.
 */
export async function runCombinedOrderCsvEtl(config: {
  filePath: string;
  delimiter?: string;
}): Promise<CombinedOrderCsvResult> {
  const start = Date.now();

  const validOrdreCols = await getTableColumns('ordre');
  const validOrdrelinjeCols = await getTableColumns('ordrelinje');

  const source = csvRowSource(config.filePath, config.delimiter);
  const iterator = source[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    return {
      ordreInserted: 0,
      ordrelinjeInserted: 0,
      attemptedRows: 0,
      rejectedOrdreRows: 0,
      rejectedOrdrelinjeRows: 0,
    };
  }

  const normalizedFirst = Object.keys(normalizeRecord(first.value));
  const ordrePlan = buildColumnPlan(normalizedFirst, validOrdreCols);
  const ordrelinjePlan = buildColumnPlan(normalizedFirst, validOrdrelinjeCols);
  if (ordrePlan.length === 0 || ordrelinjePlan.length === 0) {
    throw new Error('Combined CSV ingest: no matching columns for ordre/ordrelinje');
  }

  let attemptedRows = 0;
  let rejectedOrdre = 0;
  let rejectedOrdrelinje = 0;

  /** Map one CSV row to formatted COPY lines per table (null when rejected). */
  function mapToLines(row: Record<string, unknown>, rowIndex: number): [string | null, string | null] {
    let ordreLine: string | null = null;
    let linjeLine: string | null = null;
    const ordreResult = mapRow(row, rowIndex, 'ordre', false, ordrePlan);
    if (ordreResult.values) {
      ordreLine = formatCopyLine(ordreResult.values);
    } else {
      rejectedOrdre += 1;
    }
    const linjeResult = mapRow(row, rowIndex, 'ordrelinje', false, ordrelinjePlan);
    if (linjeResult.values) {
      linjeLine = formatCopyLine(linjeResult.values);
    } else {
      rejectedOrdrelinje += 1;
    }
    return [ordreLine, linjeLine];
  }

  const ordreTemp = `temp_ordre_combined_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const linjeTemp = `temp_ordrelinje_combined_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const ordreTarget: CopyTarget = {
    tableName: 'ordre',
    columns: ordrePlan.map((c) => c.dbColumn),
    tempTable: ordreTemp,
  };
  const linjeTarget: CopyTarget = {
    tableName: 'ordrelinje',
    columns: ordrelinjePlan.map((c) => c.dbColumn),
    tempTable: linjeTemp,
  };

  const clientOrdre = await getClient();
  const clientLinje = await getClient();

  const rollbackQuietly = async (client: StagedClient): Promise<void> => {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already aborted */
    }
  };

  let copyOrdre!: CopyStream;
  let copyLinje!: CopyStream;

  try {
    copyOrdre = await beginStagingCopy(clientOrdre, ordreTarget);
    copyLinje = await beginStagingCopy(clientLinje, linjeTarget);

    // Phase 1: single pass over the CSV feeding both COPY streams in lockstep.
    let rowIndex = 0;
    const writePair = async (pair: [string | null, string | null]): Promise<void> => {
      const [ordreLine, linjeLine] = pair;
      let needDrainO = false;
      let needDrainL = false;
      if (ordreLine !== null && !copyOrdre.write(ordreLine)) needDrainO = true;
      if (linjeLine !== null && !copyLinje.write(linjeLine)) needDrainL = true;
      if (needDrainO) await drain(copyOrdre);
      if (needDrainL) await drain(copyLinje);
    };

    await writePair(mapToLines(first.value, rowIndex));
    rowIndex += 1;
    attemptedRows += 1;

    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      await writePair(mapToLines(next.value, rowIndex));
      rowIndex += 1;
      attemptedRows += 1;
    }

    copyOrdre.end();
    copyLinje.end();

    await Promise.all([
      waitForCopyFinish(copyOrdre),
      waitForCopyFinish(copyLinje),
    ]);

    // Phase 2: merge ordre (dimensions before merge, inside txn).
    await provisionDimensions(clientOrdre, ordreTemp, ordreTarget.columns);
    const ordreResult = await clientOrdre.query(
      `INSERT INTO ordre (${ordreTarget.columns.join(', ')})
       SELECT ${ordreTarget.columns.join(', ')} FROM ${ordreTemp}
       ON CONFLICT DO NOTHING`
    );
    const ordreInserted = ordreResult.rowCount || 0;
    await clientOrdre.query('COMMIT');

    // Phase 3: ordre committed -> FK-safe to merge order lines now.
    await provisionDimensions(clientLinje, linjeTemp, linjeTarget.columns);
    const linjeResult = await clientLinje.query(
      `INSERT INTO ordrelinje (${linjeTarget.columns.join(', ')})
       SELECT ${linjeTarget.columns.join(', ')} FROM ${linjeTemp}
       ON CONFLICT DO NOTHING`
    );
    const ordrelinjeInserted = linjeResult.rowCount || 0;
    await clientLinje.query('COMMIT');

    scheduleStatisticsRefreshAfterEtl('ordre');
    scheduleStatisticsRefreshAfterEtl('ordrelinje');

    const durationMs = Date.now() - start;
    etlLogger.info(
      {
        stage: 'combined-order-csv-complete',
        filePath: config.filePath,
        attemptedRows,
        ordreInserted,
        ordrelinjeInserted,
        rejectedOrdreRows: rejectedOrdre,
        rejectedOrdrelinjeRows: rejectedOrdrelinje,
        durationMs,
        rowsPerSecond: durationMs > 0 ? Math.round((attemptedRows * 1000) / durationMs) : 0,
      },
      'Combined order CSV ETL completed (single pass)'
    );

    return {
      ordreInserted,
      ordrelinjeInserted,
      attemptedRows,
      rejectedOrdreRows: rejectedOrdre,
      rejectedOrdrelinjeRows: rejectedOrdrelinje,
    };
  } catch (err) {
    // Mirrors copyLoaders.ts failure handling: abort both open transactions.
    await rollbackQuietly(clientOrdre);
    await rollbackQuietly(clientLinje);
    throw err;
  } finally {
    clientOrdre.release();
    clientLinje.release();
  }
}
