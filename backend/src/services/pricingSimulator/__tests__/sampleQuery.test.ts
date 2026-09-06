/**
 * Unit tests for the simulator sample-query guards.
 *
 * Mocks db/pool — no database needed. Verifies the early return for
 * non-positive limits never touches the pool.
 */
jest.mock('../../../db/pool', () => ({
  __esModule: true,
  default: { connect: jest.fn() },
}));

import pool from '../../../db/pool';
import { fetchSampleLines } from '../sampleQuery';

const mockConnect = (pool as unknown as { connect: jest.Mock }).connect;

describe('fetchSampleLines guards', () => {
  afterEach(() => jest.resetAllMocks());

  it.each([0, -5, NaN])('returns [] without a DB round-trip for limit %s', async (limit) => {
    await expect(fetchSampleLines(undefined, undefined, limit)).resolves.toEqual([]);
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('keeps the default sample size bounded (1000) in the SQL params', async () => {
    const mockClient = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    mockConnect.mockResolvedValueOnce(mockClient);
    await fetchSampleLines('2024-01-01', '2024-12-31');
    const dataQuery = mockClient.query.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('sample_lines'),
    ) as [string, unknown[]];
    expect(dataQuery).toBeDefined();
    // startDate, endDate, then the capped default limit
    expect(dataQuery[1]).toEqual(['2024-01-01', '2024-12-31', 1000]);
  });
});
