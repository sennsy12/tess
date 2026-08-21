export type TimeBucket = 'day' | 'week' | 'month' | 'quarter';

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface TopNOptions<T> {
  withOther?: boolean;
  /** Required when `withOther` is true — builds the aggregated remainder row. */
  createOther?: (sum: number) => T;
}

export function topN<T>(
  items: T[],
  n: number,
  by: (item: T) => number,
  options?: TopNOptions<T>,
): T[] {
  const sorted = [...items].sort((a, b) => by(b) - by(a));
  if (sorted.length <= n) return sorted;

  const top = sorted.slice(0, n);
  if (!options?.withOther || !options.createOther) return top;

  const restSum = sorted.slice(n).reduce((acc, item) => acc + by(item), 0);
  if (restSum <= 0) return top;

  return [...top, options.createOther(restSum)];
}

export function buildTimeSeries<T>(
  rows: T[],
  opts: {
    date: (row: T) => Date;
    value: (row: T) => number;
    bucket: TimeBucket;
  },
): Array<{ date: string; value: number }> {
  const buckets = new Map<string, number>();

  for (const row of rows) {
    const key = formatBucketKey(opts.date(row), opts.bucket);
    buckets.set(key, (buckets.get(key) ?? 0) + opts.value(row));
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function fillMissingBuckets(
  series: Array<{ date: string; value: number }>,
  from: string,
  to: string,
  bucket: TimeBucket,
): Array<{ date: string; value: number }> {
  const byDate = new Map(series.map((point) => [point.date, point.value]));
  const filled: Array<{ date: string; value: number }> = [];

  let cursor = parseBucketStart(from, bucket);
  const end = parseBucketStart(to, bucket);

  while (cursor <= end) {
    const key = formatBucketKey(cursor, bucket);
    filled.push({ date: key, value: byDate.get(key) ?? 0 });
    cursor = advanceBucket(cursor, bucket);
  }

  return filled;
}

/** Fills missing `period` keys in time-series chart data (month/day buckets). */
export function fillMissingPeriods<T extends { period: string; total_sum?: number }>(
  points: T[],
  bucket: Extract<TimeBucket, 'day' | 'month'> = 'month',
): T[] {
  if (points.length === 0) return points;

  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const byPeriod = new Map(sorted.map((point) => [point.period, point]));
  const from = sorted[0].period;
  const to = sorted[sorted.length - 1].period;

  const filledScalars = fillMissingBuckets(
    sorted.map((point) => ({ date: point.period, value: Number(point.total_sum) || 0 })),
    from,
    to,
    bucket,
  );

  return filledScalars.map((point) => {
    const existing = byPeriod.get(point.date);
    if (existing) return existing;
    return {
      ...sorted[0],
      period: point.date,
      total_sum: point.value,
      order_count: 0,
    } as T;
  });
}

function formatBucketKey(date: Date, bucket: TimeBucket): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (bucket === 'day') return `${year}-${month}-${day}`;
  if (bucket === 'month') return `${year}-${month}`;
  if (bucket === 'quarter') return `${year}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  const week = getIsoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function parseBucketStart(value: string, bucket: TimeBucket): Date {
  if (bucket === 'month') {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }
  if (bucket === 'day') {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  if (bucket === 'quarter') {
    const [yearPart, quarterPart] = value.split('-Q');
    const quarter = Number(quarterPart);
    return new Date(Number(yearPart), (quarter - 1) * 3, 1);
  }
  const [yearPart, weekPart] = value.split('-W');
  return isoWeekStart(Number(yearPart), Number(weekPart));
}

function advanceBucket(date: Date, bucket: TimeBucket): Date {
  const next = new Date(date);
  if (bucket === 'day') {
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (bucket === 'week') {
    next.setDate(next.getDate() + 7);
    return next;
  }
  if (bucket === 'quarter') {
    next.setMonth(next.getMonth() + 3);
    return next;
  }
  next.setMonth(next.getMonth() + 1);
  return next;
}

function getIsoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function isoWeekStart(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay();
  const diff = simple.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(simple.setDate(diff));
}
