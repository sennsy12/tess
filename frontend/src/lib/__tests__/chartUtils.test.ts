import { describe, it, expect } from 'vitest';
import { percentChange, fillMissingBuckets, topN } from '../chartUtils';

describe('chartUtils', () => {
  it('calculates percent change', () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBeNull();
  });

  it('returns top N items by value', () => {
    const items = [{ id: 1, value: 5 }, { id: 2, value: 10 }, { id: 3, value: 1 }];
    expect(topN(items, 2, (item) => item.value).map((item) => item.id)).toEqual([2, 1]);
  });

  it('aggregates remainder into an other bucket', () => {
    const items = [
      { name: 'A', total_sum: 100 },
      { name: 'B', total_sum: 80 },
      { name: 'C', total_sum: 20 },
      { name: 'D', total_sum: 10 },
    ];
    const result = topN(items, 2, (item) => item.total_sum, {
      withOther: true,
      createOther: (sum) => ({ name: 'Andre', total_sum: sum }),
    });
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ name: 'Andre', total_sum: 30 });
  });

  it('fills missing month buckets with zero', () => {
    const filled = fillMissingBuckets(
      [{ date: '2024-01', value: 100 }, { date: '2024-03', value: 200 }],
      '2024-01',
      '2024-03',
      'month',
    );
    expect(filled).toEqual([
      { date: '2024-01', value: 100 },
      { date: '2024-02', value: 0 },
      { date: '2024-03', value: 200 },
    ]);
  });
});
