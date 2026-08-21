import { chunk, splitEvenly, asyncPool, sortByNb } from '../collections.js';

describe('collections', () => {
  it('chunks arrays by size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('splits arrays evenly into parts', () => {
    expect(splitEvenly([1, 2, 3, 4, 5], 2)).toEqual([[1, 2, 3], [4, 5]]);
  });

  it('runs asyncPool with concurrency limit', async () => {
    const items = [1, 2, 3, 4];
    const results = await asyncPool(2, items, async (value) => value * 2);
    expect(results).toEqual([2, 4, 6, 8]);
  });

  it('sorts using Norwegian locale', () => {
    const sorted = sortByNb(['åpning', 'apple', 'æble'], (value) => value);
    expect(sorted[0]).toBe('apple');
  });
});
