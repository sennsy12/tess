import { StreamingEtlResult } from './streaming/types.js';

interface EtlRunMetric extends StreamingEtlResult {
  finishedAt: string;
}

export interface BulkFastRunMetric {
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
  maxHeapUsedMb?: number;
  jobId?: string;
  finishedAt: string;
}

interface EtlMetricsSummary {
  totalRuns: number;
  totalInsertedRows: number;
  totalRejectedRows: number;
  avgRowsPerSecond: number;
  lastRun: EtlRunMetric | null;
  lastBulkRun: BulkFastRunMetric | null;
  /** p50, p95, p99 duration in ms */
  durationPercentiles: { p50: number; p95: number; p99: number };
  /** Histogram: duration buckets in ms [0-1s, 1-5s, 5-30s, 30s-2m, 2m+] */
  durationHistogram: number[];
}

const MAX_RECENT_RUNS = 50;
const MAX_RECENT_BULK_RUNS = 20;
const recentRuns: EtlRunMetric[] = [];
const recentBulkRuns: BulkFastRunMetric[] = [];

const DURATION_BUCKETS = [1000, 5000, 30_000, 120_000, Infinity];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function recordEtlRun(result: StreamingEtlResult): void {
  const run: EtlRunMetric = {
    ...result,
    finishedAt: new Date().toISOString(),
  };
  recentRuns.unshift(run);
  if (recentRuns.length > MAX_RECENT_RUNS) {
    recentRuns.pop();
  }
}

export function recordBulkFastRun(result: {
  totalRows: number;
  insertionTimeMs: number;
  rowsPerSecond: number;
  maxHeapUsedMb?: number;
  jobId?: string;
}): void {
  const run: BulkFastRunMetric = {
    ...result,
    finishedAt: new Date().toISOString(),
  };
  recentBulkRuns.unshift(run);
  if (recentBulkRuns.length > MAX_RECENT_BULK_RUNS) {
    recentBulkRuns.pop();
  }
}

export function getEtlMetrics(options?: { jobId?: string }) {
  const totalRuns = recentRuns.length;
  const totalInsertedRows = recentRuns.reduce((sum, run) => sum + run.insertedRows, 0);
  const totalRejectedRows = recentRuns.reduce((sum, run) => sum + run.rejectedRows, 0);
  const avgRowsPerSecond =
    totalRuns > 0
      ? Number((recentRuns.reduce((sum, run) => sum + run.rowsPerSecond, 0) / totalRuns).toFixed(2))
      : 0;

  const durations = recentRuns.map((r) => r.durationMs).sort((a, b) => a - b);
  const durationPercentiles = {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  };

  const durationHistogram = DURATION_BUCKETS.map((_, i) => {
    const low = i === 0 ? 0 : DURATION_BUCKETS[i - 1];
    const high = DURATION_BUCKETS[i];
    return recentRuns.filter((r) => r.durationMs >= low && r.durationMs < high).length;
  });

  let recentRunsFiltered = recentRuns;
  let recentBulkRunsFiltered = recentBulkRuns;
  if (options?.jobId) {
    recentRunsFiltered = recentRuns.filter((r) => (r as EtlRunMetric & { jobId?: string }).jobId === options.jobId);
    recentBulkRunsFiltered = recentBulkRuns.filter((r) => r.jobId === options.jobId);
  }

  const summary: EtlMetricsSummary = {
    totalRuns,
    totalInsertedRows,
    totalRejectedRows,
    avgRowsPerSecond,
    lastRun: recentRuns[0] || null,
    lastBulkRun: recentBulkRuns[0] || null,
    durationPercentiles,
    durationHistogram,
  };

  return {
    summary,
    recentRuns: recentRunsFiltered,
    recentBulkRuns: recentBulkRunsFiltered,
  };
}

export function clearEtlMetrics(): void {
  recentRuns.length = 0;
  recentBulkRuns.length = 0;
}
