import { PassThrough } from 'stream';
import { once } from 'events';
import { copyFromLineStream } from '../../db/index.js';
import { etlLogger } from '../../lib/logger.js';
import { formatCopyLine } from '../streaming/transforms.js';
import { getOrderRows } from './orderGeneration.js';
import { ensureDimensionData } from './dimensions.js';
import { dropBulkIndexes, createBulkIndexes } from './indexes.js';

const ORDRE_COLS = ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'];
const ORDRELINJE_COLS = ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'];
const HENVISNING_COLS = ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'];

/**
 * Pure streaming bulk: generate one order at a time and pipe to three COPY streams in parallel.
 * O(1) memory – no batches, no arrays. Best for 20M+ rows; single loop feeds ordre + ordrelinje + henvisning.
 */
export async function runBulkPipelineStreaming(config: {
  totalOrders: number;
  customers?: number;
  linesPerOrder?: number;
}): Promise<{
  ordrer: number;
  ordrelinjer: number;
  ordre_henvisninger: number;
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
}> {
  const { totalOrders, customers = 1000, linesPerOrder = 5 } = config;
  const startTime = Date.now();

  etlLogger.info(
    { stage: 'bulk-streaming-start', totalOrders },
    'Starting streaming bulk pipeline (O(1) memory, parallel COPY)'
  );

  await ensureDimensionData(customers);
  await dropBulkIndexes();

  const ptOrdre = new PassThrough({ objectMode: false });
  const ptOrdrelinje = new PassThrough({ objectMode: false });
  const ptHenvisning = new PassThrough({ objectMode: false });

  // All three staging COPYs run in parallel; only the final merges are
  // sequenced ordre -> ordrelinje -> henvisning so FK constraints hold.
  let signalOrdreDone!: () => void;
  let signalOrdrelinjeDone!: () => void;
  const ordreCommitted = new Promise<void>((resolve) => { signalOrdreDone = resolve; });
  const ordrelinjeCommitted = new Promise<void>((resolve) => { signalOrdrelinjeDone = resolve; });

  const settle = <T>(signal: () => void, promise: Promise<T>): Promise<T> =>
    promise.then(
      (value) => { signal(); return value; },
      (err) => { signal(); throw err; }
    );

  const copyOrdreP = settle(signalOrdreDone, copyFromLineStream('ordre', ORDRE_COLS, ptOrdre, 'nothing'));
  const copyOrdrelinjeP = settle(
    signalOrdrelinjeDone,
    copyFromLineStream('ordrelinje', ORDRELINJE_COLS, ptOrdrelinje, 'nothing', {
      beforeFinalInsert: () => ordreCommitted,
    })
  );
  const copyHenvisningP = copyFromLineStream('ordre_henvisning', HENVISNING_COLS, ptHenvisning, 'nothing', {
    beforeFinalInsert: () => ordrelinjeCommitted,
  });

  for (let i = 1; i <= totalOrders; i++) {
    const { ordre, ordrelinjer, henvisninger } = getOrderRows(i, customers, linesPerOrder);
    const needDrainO = !ptOrdre.write(formatCopyLine(ordre));
    let needDrainL = false;
    let needDrainH = false;
    for (const row of ordrelinjer) needDrainL = !ptOrdrelinje.write(formatCopyLine(row)) || needDrainL;
    for (const row of henvisninger) needDrainH = !ptHenvisning.write(formatCopyLine(row)) || needDrainH;
    if (needDrainO) await once(ptOrdre, 'drain');
    if (needDrainL) await once(ptOrdrelinje, 'drain');
    if (needDrainH) await once(ptHenvisning, 'drain');
  }
  ptOrdre.end();
  ptOrdrelinje.end();
  ptHenvisning.end();

  const [ordrer, ordrelinjer, ordre_henvisninger] = await Promise.all([copyOrdreP, copyOrdrelinjeP, copyHenvisningP]);

  await createBulkIndexes();

  const duration = Date.now() - startTime;
  const totalRows = ordrer + ordrelinjer + ordre_henvisninger;
  etlLogger.info(
    { stage: 'bulk-streaming-complete', totalRows, durationMs: duration, rowsPerSecond: Math.round(totalRows / (duration / 1000)) },
    'Streaming bulk pipeline completed'
  );

  return {
    ordrer,
    ordrelinjer,
    ordre_henvisninger,
    totalRows,
    insertionTimeMs: duration,
    rowsPerSecond: Math.round(totalRows / (duration / 1000)),
  };
}
