import fs from 'fs/promises';
import path from 'path';
import { runStreamingEtl } from './streaming/pipeline.js';
import { etlLogger } from '../lib/logger.js';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

/**
 * Generates a CSV file with ordrelinje-shaped rows (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
 * and runs the streaming ETL on it. Returns timing and throughput (rows/sec, rows/ms, ms/row).
 * Use for load testing and speed comparison.
 */
export async function runStreamingBenchmark(rows: number): Promise<{
  rows: number;
  durationMs: number;
  insertedRows: number;
  attemptedRows: number;
  rejectedRows: number;
  rowsPerSecond: number;
  rowsPerMillisecond: number;
  msPerInsertedRow: number;
  writeMs: number;
}> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const filePath = path.join(UPLOADS_DIR, `benchmark-${Date.now()}-${rows}.csv`);

  const header = 'linjenr;ordrenr;varekode;antall;enhet;nettpris;linjesum;linjestatus\n';
  const line = (i: number) => {
    const ordrenr = 10000 + Math.floor(i / 5);
    const linjenr = (i % 5) + 1;
    const varekode = `V${String((i % 500) + 1).padStart(5, '0')}`;
    const antall = (i % 50) + 1;
    const nettpris = (i % 5000) + 50;
    const linjesum = antall * nettpris;
    return `${linjenr};${ordrenr};${varekode};${antall};stk;${nettpris};${linjesum};1`;
  };

  etlLogger.info({ rows, filePath }, 'Writing benchmark CSV');
  const writeStart = Date.now();
  const stream = (await import('fs')).createWriteStream(filePath, { encoding: 'utf-8' });
  stream.write(header);
  for (let i = 0; i < rows; i++) {
    stream.write(line(i) + '\n');
    if (i > 0 && i % 100_000 === 0) {
      await new Promise((r) => stream.write('', r));
    }
  }
  await new Promise<void>((resolve, reject) => {
    stream.end((err: NodeJS.ErrnoException | null) => (err ? reject(err) : resolve()));
  });
  const writeMs = Date.now() - writeStart;
  etlLogger.info({ rows, writeMs }, 'Benchmark CSV written, starting ETL');

  try {
    const result = await runStreamingEtl({
      sourceType: 'csv',
      table: 'ordrelinje',
      csv: { filePath, delimiter: ';' },
      onConflict: 'nothing',
      strictMode: false,
    });

    const durationMs = result.durationMs;
    const rowsPerSecond = result.rowsPerSecond;
    const rowsPerMillisecond = durationMs > 0 ? Number((result.insertedRows / durationMs).toFixed(4)) : 0;
    const msPerInsertedRow =
      result.insertedRows > 0 ? Number((durationMs / result.insertedRows).toFixed(3)) : 0;

    return {
      rows,
      durationMs,
      insertedRows: result.insertedRows,
      attemptedRows: result.attemptedRows,
      rejectedRows: result.rejectedRows,
      rowsPerSecond,
      rowsPerMillisecond,
      msPerInsertedRow,
      writeMs,
    };
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}
