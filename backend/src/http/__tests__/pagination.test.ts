/**
 * Unit tests for the shared HTTP pagination parser.
 */
import { parsePagination } from '../pagination';

describe('parsePagination', () => {
  it('returns defaults for empty query', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 50, offset: 0 });
  });

  it('parses valid page/limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({
      page: 3,
      limit: 10,
      offset: 20,
    });
  });

  it('falls back to defaults on garbage input', () => {
    expect(parsePagination({ page: 'abc', limit: '-5' })).toEqual({
      page: 1,
      limit: 50,
      offset: 0,
    });
  });

  it('clamps runaway limits', () => {
    expect(parsePagination({ limit: '1000000' }).limit).toBe(200);
  });

  it('respects custom defaults and maxLimit', () => {
    expect(parsePagination({}, { page: 2, limit: 10 })).toEqual({
      page: 2,
      limit: 10,
      offset: 10,
    });
    expect(parsePagination({ limit: '500' }, { maxLimit: 100 }).limit).toBe(100);
  });
});
