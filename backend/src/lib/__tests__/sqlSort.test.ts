/**
 * Unit tests for `buildOrderByClause` (lib/sqlSort).
 *
 * This is the whitelist gate for all server-side table sorting: it maps
 * client-supplied `sortBy` keys to server-owned column expressions, so an
 * unknown/malicious key must silently fall back to the default order
 * instead of reaching the SQL string.
 */
import { buildOrderByClause } from '../sqlSort.js';

const COLUMNS = {
  sum: 'o.sum',
  dato: 'o.dato',
  kundenavn: 'k.kundenavn',
} as const;

describe('buildOrderByClause', () => {
  it('maps a known key to its column expression with the requested direction', () => {
    expect(buildOrderByClause(COLUMNS, 'sum', 'asc', 'o.dato')).toBe('o.sum ASC');
    expect(buildOrderByClause(COLUMNS, 'dato', 'desc', 'o.dato')).toBe('o.dato DESC');
  });

  it('defaults to DESC when no direction is given', () => {
    expect(buildOrderByClause(COLUMNS, 'sum', undefined, 'o.dato')).toBe('o.sum DESC');
  });

  it('falls back to the default expression for unknown keys (injection-safe)', () => {
    // Attempted SQL injection / stale client keys must never reach SQL.
    expect(buildOrderByClause(COLUMNS, 'sum; DROP TABLE ordre', 'asc', 'o.dato')).toBe(
      'o.dato ASC',
    );
    expect(buildOrderByClause(COLUMNS, 'nonexistent', 'desc', 'o.dato')).toBe('o.dato DESC');
  });

  it('falls back to the default expression when sortBy is missing', () => {
    expect(buildOrderByClause(COLUMNS, undefined, 'asc', 'o.dato')).toBe('o.dato ASC');
    expect(buildOrderByClause(COLUMNS, '', 'asc', 'o.dato')).toBe('o.dato ASC');
  });
});
