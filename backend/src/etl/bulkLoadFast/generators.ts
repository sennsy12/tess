import {
  takeBuffer,
  returnBuffer,
  writeCopyValue,
  writeCopyField,
  writeCopyRowEnd,
  COPY_BUFFER_SIZE,
} from '../copyBufferEncoder.js';
import { TableMetrics, BatchStats, BUFFER_RESERVE } from './shared.js';

/** Table of Contents -> Lager seeded by ensureDimensionData (bulkData/dimensions.ts). */
const LAGER_BY_FIRMA: Record<number, string> = {
  1: 'Hovedkontor Oslo Hovedlager',
  2: 'Region Vest Hovedlager',
  3: 'Region Sør Hovedlager',
  4: 'Region Midt Hovedlager',
  5: 'Region Nord Hovedlager',
};

/**
 * Deterministiske linjeformler for bulk-generatoren. MÅ være identiske i
 * ordre- og ordrelinje-generatoren, ellers spriker ordresum og linjesum.
 */
export function bulkNumLines(i: number, linesPerOrder: number): number {
  return ((i * 7) % linesPerOrder) + 1;
}

export function bulkAntall(i: number, j: number): number {
  return ((i + j) % 50) + 1;
}

export function bulkNettpris(i: number, j: number): number {
  return ((i * 11 + j) % 5000) + 50;
}

export function bulkLinjesum(i: number, j: number): number {
  return bulkAntall(i, j) * bulkNettpris(i, j);
}

/** Ordresum = summen av linjene ordrelinje-generatoren skriver for samme ordre. */
export function bulkOrderSum(i: number, linesPerOrder: number): number {
  let sum = 0;
  const numLines = bulkNumLines(i, linesPerOrder);
  for (let j = 1; j <= numLines; j++) sum += bulkLinjesum(i, j);
  return sum;
}

/** Async generator yielding COPY buffer chunks for ordre table (buffer pool, no per-row arrays). */
export async function* generateOrdreCopyBuffers(
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
      const kundenr = `K${String((i % customers) + 1).padStart(6, '0')}`;
      const firmaid = (i % 5) + 1;
      const ordrenr = 10000 + i;
      const year = 2024 + (i % 3);
      const month = (i % 12) + 1;
      const day = (i % 28) + 1;
      const dato = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const kundeordreref = `PO-${year}-${String(ordrenr).padStart(6, '0')}`;
      const kunderef = 'Auto Bulk Kunde';
      const lagernavn = LAGER_BY_FIRMA[firmaid];
      const valuta = 'NOK';
      const sum = bulkOrderSum(i, linesPerOrder);

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
export async function* generateOrdrelinjeCopyBuffers(
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
      const numLines = bulkNumLines(i, linesPerOrder);

      for (let j = 1; j <= numLines; j++) {
        const varekode = `V${String((i * j) % 500 + 1).padStart(5, '0')}`;
        const antall = bulkAntall(i, j);
        const nettpris = bulkNettpris(i, j);
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
export async function* generateHenvisningCopyBuffers(
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
