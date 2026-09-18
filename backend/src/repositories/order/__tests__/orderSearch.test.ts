/**
 * Unit tests for the paginated reference search.
 *
 * Mocks db/index (query) — no database needed. Verifies the COUNT(*) OVER()
 * envelope, default/capped LIMIT/OFFSET, and preserved kunde scoping.
 */
jest.mock('../../../db/index', () => ({
  query: jest.fn(),
}));

import { searchOrdersByReference } from '../orderSearch';
import { query } from '../../../db/index';

const mockQuery = query as jest.MockedFunction<typeof query>;

function mockRows(rows: Array<Record<string, unknown>>) {
  mockQuery.mockResolvedValueOnce({
    rows,
    rowCount: rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  } as any);
}

describe('searchOrdersByReference', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns { data, total } and strips the window-count column', async () => {
    mockRows([
      { ordrenr: 1, _total_count: 2 },
      { ordrenr: 2, _total_count: 2 },
    ]);
    const result = await searchOrdersByReference('REF123', { role: 'admin' });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).not.toHaveProperty('_total_count');
  });

  it('applies default LIMIT 50 OFFSET 0 when pagination is omitted', async () => {
    mockRows([]);
    await searchOrdersByReference('abc');
    const [sql, params] = mockQuery.mock.calls[0] as [string, Array<string | number>];
    expect(sql).toContain('COUNT(*) OVER()');
    expect(sql).toContain('LIMIT $2 OFFSET $3');
    expect(params).toEqual(['%abc%', 50, 0]);
  });

  it('passes custom pagination through and caps limit at 200', async () => {
    mockRows([]);
    await searchOrdersByReference('abc', undefined, { limit: 100000, offset: 40 });
    const params = mockQuery.mock.calls[0][1] as Array<string | number>;
    expect(params.slice(-2)).toEqual([200, 40]);
  });

  it('keeps kunde scoping with correct param indexes', async () => {
    mockRows([]);
    await searchOrdersByReference('abc', { role: 'kunde', kundenr: 'K1' }, { limit: 10, offset: 0 });
    const [sql, params] = mockQuery.mock.calls[0] as [string, Array<string | number>];
    expect(sql).toContain('o.kundenr = $2');
    expect(sql).toContain('LIMIT $3 OFFSET $4');
    expect(params).toEqual(['%abc%', 'K1', 10, 0]);
  });

  // ── Regression: reference rows are line-level, so an order can match ──
  // ── through many of its lines. The match must run in a semi-join      ──
  // ── (EXISTS), never in a row-multiplying join paired with the         ──
  // ── window count. Live-measured: old form reported total=2 for a      ──
  // ── one-order match through 2 lines; the fixed form reports 1.        ──

  it('matches references in a semi-join so line fan-out cannot multiply rows', async () => {
    mockRows([]);
    await searchOrdersByReference('REF123');
    const [sql] = mockQuery.mock.calls[0] as [string, Array<string | number>];
    expect(sql).toContain('WHERE EXISTS (');
    // The old fan-out join must never return as a top-level join.
    expect(sql).not.toContain('INNER JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr');
    // SELECT DISTINCT was only there to collapse the fan-out — its absence
    // proves the main query yields at most one row per order.
    expect(sql).not.toContain('SELECT DISTINCT');
  });

  it('still counts pre-pagination matches over orders, not line rows', async () => {
    // Envelope contract: a one-row page whose window count reflects the
    // full distinct-order match count (extractWindowCountPage reads it
    // from the first row).
    mockRows([{ ordrenr: 7, kundenavn: 'K', firmanavn: 'F', _total_count: 1 }]);
    const result = await searchOrdersByReference('REF123');
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0]).not.toHaveProperty('_total_count');
  });
});
