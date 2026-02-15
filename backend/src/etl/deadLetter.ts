import fs from 'fs/promises';
import path from 'path';
import { DeadLetterRow } from './streaming/types.js';

const DEAD_LETTER_DIR = process.env.ETL_DEAD_LETTER_DIR || path.join(process.cwd(), 'uploads', 'dead-letter');
const MAX_BUFFER = 10_000;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DEAD_LETTER_DIR, { recursive: true });
}

/** Append rows to an existing file. Used by the single-file-per-job collector. */
async function appendDeadLetterRows(filePath: string, rows: DeadLetterRow[]): Promise<void> {
  if (rows.length === 0) return;
  const lines = rows.map((r) => JSON.stringify(r) + '\n');
  await fs.appendFile(filePath, lines.join(''), 'utf-8');
}

export async function writeDeadLetterFile(
  jobId: string,
  table: string,
  rows: DeadLetterRow[]
): Promise<{ path: string; count: number }> {
  if (rows.length === 0) return { path: '', count: 0 };
  await ensureDir();
  const base = `dead-letter-${jobId}-${table}-${Date.now()}.ndjson`;
  const filePath = path.join(DEAD_LETTER_DIR, base);
  const lines = rows.map((r) => JSON.stringify(r) + '\n');
  await fs.writeFile(filePath, lines.join(''), 'utf-8');
  return { path: filePath, count: rows.length };
}

/**
 * Creates a dead-letter collector that writes to a single file per job.
 * On capacity flush or final flush, rows are appended to that file.
 * Reported path and count are the single file and total rejected count.
 */
export function createDeadLetterCollector(jobId: string, table: string) {
  const buffer: DeadLetterRow[] = [];
  const base = `dead-letter-${jobId}-${table}-${Date.now()}.ndjson`;
  let filePath: string | null = null;
  let totalFlushedCount = 0;

  async function ensurePath(): Promise<string> {
    if (filePath) return filePath;
    await ensureDir();
    filePath = path.join(DEAD_LETTER_DIR, base);
    return filePath;
  }

  async function flushBuffer(): Promise<void> {
    if (buffer.length === 0) return;
    const path = await ensurePath();
    await appendDeadLetterRows(path, buffer);
    totalFlushedCount += buffer.length;
    buffer.length = 0;
  }

  return {
    add(rowIndex: number, raw: Record<string, unknown>, error: string): void {
      buffer.push({
        rowIndex,
        raw,
        error,
        timestamp: new Date().toISOString(),
      });
    },

    async flush(): Promise<{ path: string; count: number }> {
      await flushBuffer();
      const path = filePath ?? (await ensurePath());
      const totalCount = totalFlushedCount;
      return { path, count: totalCount };
    },

    /** Flush to disk when buffer exceeds MAX_BUFFER to avoid OOM. Returns true if flushed. */
    async flushIfOverCapacity(): Promise<boolean> {
      if (buffer.length >= MAX_BUFFER) {
        await flushBuffer();
        return true;
      }
      return false;
    },

    count(): number {
      return buffer.length;
    },

    /** Total count that will be reported (already flushed + current buffer). */
    totalCount(): number {
      return totalFlushedCount + buffer.length;
    },
  };
}
