import { StreamingEtlResult } from './streaming/types.js';

interface EtlRunMetric extends StreamingEtlResult {
  finishedAt: string;
}

interface EtlMetricsSummary {
  totalRuns: number;
  totalInsertedRows: number;
  totalRejectedRows: number;
  avgRowsPerSecond: number;
  lastRun: EtlRunMetric | null;
}

const MAX_RECENT_RUNS = 50;
const recentRuns: EtlRunMetric[] = [];

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

export function getEtlMetrics() {
  const totalRuns = recentRuns.length;
  const totalInsertedRows = recentRuns.reduce((sum, run) => sum + run.insertedRows, 0);
  const totalRejectedRows = recentRuns.reduce((sum, run) => sum + run.rejectedRows, 0);
  const avgRowsPerSecond = totalRuns > 0
    ? Number((recentRuns.reduce((sum, run) => sum + run.rowsPerSecond, 0) / totalRuns).toFixed(2))
    : 0;

  const summary: EtlMetricsSummary = {
    totalRuns,
    totalInsertedRows,
    totalRejectedRows,
    avgRowsPerSecond,
    lastRun: recentRuns[0] || null,
  };

  return {
    summary,
    recentRuns,
  };
}

export function clearEtlMetrics(): void {
  recentRuns.length = 0;
}
