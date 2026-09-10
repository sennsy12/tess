import { describe, it, expect } from 'vitest';
import {
  sumBy,
  latestByString,
  positiveRevenue,
  sparkSeries,
} from '../statsAggregation';
import type { TimeSeriesPoint } from '../api/statistics';

/** Runtime-data kan inneholde nullish tallfelt selv om typen sier number. */
const asPoints = (points: unknown): TimeSeriesPoint[] => points as TimeSeriesPoint[];

describe('sumBy', () => {
  it('summerer verdier i én gjennomkjøring', () => {
    const orders = [{ sum: 100 }, { sum: 250 }, { sum: 50 }];
    expect(sumBy(orders, (o) => o.sum)).toBe(400);
  });

  it('tellermanglende/nullish verdier som 0', () => {
    const orders = asPoints([
      { period: '2024-01', sum: null },
      { period: '2024-02', sum: 10 },
    ]) as unknown as Array<{ sum?: number | null }>;
    expect(sumBy(orders, (o) => o.sum ?? 0)).toBe(10);
  });

  it('tom input gir 0', () => {
    expect(sumBy<{ sum: number }>([], (o) => o.sum)).toBe(0);
  });

  it('tomme rows i eksport-tabell summeres', () => {
    const rows = [{ total_sum: 0 }, { total_sum: 0 }];
    expect(sumBy(rows, (r) => r.total_sum)).toBe(0);
  });
});

describe('latestByString', () => {
  it('returnerer raden med høyeste ISO-dato', () => {
    const rows = [
      { id: 'a', dato: '2024-01-15' },
      { id: 'b', dato: '2024-06-01' },
      { id: 'c', dato: '2024-02-01' },
    ];
    expect(latestByString(rows, (row) => row.dato)).toBe(rows[1]);
  });

  it('returnerer null ved tomt input', () => {
    expect(latestByString([], (row: { dato: string }) => row.dato)).toBeNull();
  });

  it('ved lik nøkkel vinner den første raden', () => {
    const tied = [
      { id: 'first', dato: '2024-06-01' },
      { id: 'second', dato: '2024-06-01' },
    ];
    expect(latestByString(tied, (row) => row.dato)).toBe(tied[0]);
  });

  it('returnerer eneste rad selv med tom nøkkelstreng', () => {
    const single = [{ id: 'only', dato: '' }];
    expect(latestByString(single, (row) => row.dato)).toBe(single[0]);
  });
});

describe('positiveRevenue', () => {
  it('beholder kun rader med total_sum > 0 og bevarer rekkefølgen', () => {
    const rows = [
      { kundenr: '1', total_sum: 500 },
      { kundenr: '2', total_sum: 0 },
      { kundenr: '3', total_sum: -100 },
      { kundenr: '4', total_sum: 1200 },
    ];
    expect(positiveRevenue(rows)).toEqual([
      { kundenr: '1', total_sum: 500 },
      { kundenr: '4', total_sum: 1200 },
    ]);
  });

  it('filtrerer bort nullish total_sum', () => {
    const rows = [{ total_sum: null }, { total_sum: undefined }, { total_sum: 10 }];
    expect(positiveRevenue(rows)).toEqual([{ total_sum: 10 }]);
  });

  it('tom input gir tom liste', () => {
    expect(positiveRevenue([])).toEqual([]);
  });

  it('muterer ikke input og returnerer ny liste', () => {
    const rows = [{ kundenr: '1', total_sum: 500 }];
    const result = positiveRevenue(rows);
    expect(result).not.toBe(rows);
    expect(rows).toEqual([{ kundenr: '1', total_sum: 500 }]);
  });
});

describe('sparkSeries', () => {
  const points: TimeSeriesPoint[] = [
    { period: '2024-01', order_count: 10, total_sum: 1200 },
    { period: '2024-02', order_count: 12, total_sum: 3400 },
    { period: '2024-03', order_count: 8, total_sum: 900 },
  ];

  it('mapper total_sum til sparkline-verdier i rekkefølge', () => {
    expect(sparkSeries(points, 'total_sum')).toEqual([
      { value: 1200 },
      { value: 3400 },
      { value: 900 },
    ]);
  });

  it('mapper order_count til sparkline-verdier', () => {
    expect(sparkSeries(points, 'order_count')).toEqual([
      { value: 10 },
      { value: 12 },
      { value: 8 },
    ]);
  });

  it('nullish verdier blir 0', () => {
    const nullish = asPoints([
      { period: '2024-01', total_sum: null, order_count: undefined },
    ]);
    expect(sparkSeries(nullish, 'total_sum')).toEqual([{ value: 0 }]);
    expect(sparkSeries(nullish, 'order_count')).toEqual([{ value: 0 }]);
  });

  it('tom input gir tom serie', () => {
    expect(sparkSeries([], 'total_sum')).toEqual([]);
  });
});
