export type BulkFastConfig = {
  totalOrders: number;
  customers?: number;
  linesPerOrder?: number;
  /** If set, job is registered for progress and heap-abort failure. */
  jobId?: string;
};

export type TableMetrics = {
  rows: number;
};

/** Adaptive batch sizing: updated by copyIntoStagingFromText based on drain backpressure. */
export type BatchStats = {
  rowsPerBatch: number;
  drainCount: number;
  drainWaitMs: number;
  chunksWritten: number;
};

export const DEFAULT_WORK_MEM = '256MB';
export const DEFAULT_MAINT_WORK_MEM = '1GB';
export const MIN_BATCH_ROWS = 2000;
export const MAX_BATCH_ROWS = 50_000;
export const INITIAL_ROWS_PER_BATCH = 10_000;
/** Reserve bytes at end of buffer so we never overflow (max row ~300 bytes). */
export const BUFFER_RESERVE = 512;
/** Sample heap every N chunks to limit overhead. */
export const HEAP_SAMPLE_INTERVAL = 20;

export function getEnvNumber(name: string): number | undefined {
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

export const ORDRE_COLS = ['ordrenr', 'dato', 'kundenr', 'kundeordreref', 'kunderef', 'firmaid', 'lagernavn', 'valutaid', 'sum'];
export const ORDRELINJE_COLS = ['linjenr', 'ordrenr', 'varekode', 'antall', 'enhet', 'nettpris', 'linjesum', 'linjestatus'];
export const HENVISNING_COLS = ['ordrenr', 'linjenr', 'henvisning1', 'henvisning2', 'henvisning3', 'henvisning4', 'henvisning5'];
