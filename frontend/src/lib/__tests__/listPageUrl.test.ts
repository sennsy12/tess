/**
 * Tests for `lib/listPageUrl` — order filter URL sync.
 *
 * Sorting is shareable via URL (`?sortBy=sum&sortDir=asc`), so the write→read
 * path must round-trip exactly, and incomplete sort params (e.g. a lone
 * `sortBy` with no valid `sortDir`) must be ignored instead of leaving the
 * table in a half-sorted state.
 */
import { describe, it, expect } from 'vitest';
import {
  orderFiltersToSearchParams,
  orderFiltersFromSearchParams,
} from '../listPageUrl';

const EMPTY_FILTERS = {
  ordrenr: '',
  startDate: '',
  endDate: '',
  search: '',
  workflowStatus: '',
};

describe('orderFiltersToSearchParams / orderFiltersFromSearchParams', () => {
  it('round-trips sort state through the URL', () => {
    const params = orderFiltersToSearchParams(1, EMPTY_FILTERS, 'sum', 'desc');
    expect(params.get('sortBy')).toBe('sum');
    expect(params.get('sortDir')).toBe('desc');

    const parsed = orderFiltersFromSearchParams(params);
    expect(parsed.sortKey).toBe('sum');
    expect(parsed.sortDirection).toBe('desc');
  });

  it('omits page 1 and empty filters, but keeps active ones', () => {
    const params = orderFiltersToSearchParams(
      1,
      { ...EMPTY_FILTERS, search: 'k001' },
      null,
      null,
    );
    expect(params.get('page')).toBeNull();
    expect(params.get('search')).toBe('k001');
    expect(params.get('sortBy')).toBeNull();
    expect(params.get('sortDir')).toBeNull();
  });

  it('ignores incomplete sort params on read', () => {
    // sortBy without a valid sortDir must not sort at all.
    const partial = orderFiltersFromSearchParams(
      new URLSearchParams('sortBy=sum'),
    );
    expect(partial.sortKey).toBeUndefined();
    expect(partial.sortDirection).toBeUndefined();

    const invalidDir = orderFiltersFromSearchParams(
      new URLSearchParams('sortBy=sum&sortDir=sideways'),
    );
    expect(invalidDir.sortKey).toBeUndefined();
    expect(invalidDir.sortDirection).toBeUndefined();
  });

  it('round-trips page and filters alongside sorting', () => {
    const written = orderFiltersToSearchParams(
      3,
      { ...EMPTY_FILTERS, workflowStatus: 'approved' },
      'dato',
      'asc',
    );
    const parsed = orderFiltersFromSearchParams(written);
    expect(parsed.page).toBe(3);
    expect(parsed.filters?.workflowStatus).toBe('approved');
    expect(parsed.sortKey).toBe('dato');
    expect(parsed.sortDirection).toBe('asc');
  });
});
