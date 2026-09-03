import { getClient } from '../../../db/index.js';
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
import {
  beginStagingCopy,
  drain,
  makeTempTableName,
  provisionDimensions,
  rollbackQuietly,
  waitForCopyFinish,
  type CopyStream,
  type CopyTarget,
} from './combinedOrderStaging.js';

export interface CombinedOrderCsvResult {
  ordreInserted: number;
  ordrelinjeInserted: number;
  attemptedRows: number;
  rejectedOrdreRows: number;
  rejectedOrdrelinjeRows: number;
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

  const ordreTemp = makeTempTableName('temp_ordre_combined');
  const linjeTemp = makeTempTableName('temp_ordrelinje_combined');

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
