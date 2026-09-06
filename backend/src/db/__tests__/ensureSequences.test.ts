/**
 * Unit tests for the idempotent sequence reheal.
 *
 * Mocks db/pool — no database needed. Verifies the helper only ever raises
 * the sequence (GREATEST), skips missing sequences, and never throws.
 */
jest.mock('../pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../../lib/logger', () => ({
  dbLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import pool from '../pool';
import { ensureOrderCustomerSeq } from '../ensureSequences';

const mockPoolQuery = (pool as unknown as { query: jest.Mock }).query;

describe('ensureOrderCustomerSeq', () => {
  afterEach(() => jest.resetAllMocks());

  it("returns 'missing' without setval when the sequence does not exist", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ reg: null }] });
    await expect(ensureOrderCustomerSeq()).resolves.toBe('missing');
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it('raises via GREATEST (never lowers) when the sequence exists', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ reg: 'ordre_customer_seq' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(ensureOrderCustomerSeq()).resolves.toBe('ok');
    expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    const setvalSql = mockPoolQuery.mock.calls[1][0] as string;
    expect(setvalSql).toContain('setval');
    expect(setvalSql).toContain('GREATEST');
    expect(setvalSql).not.toContain('nextval');
  });

  it("returns 'failed' instead of throwing on DB errors", async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error('connection refused'));
    await expect(ensureOrderCustomerSeq()).resolves.toBe('failed');
  });
});
