/**
 * Controller-level tests for GET /orders sort pass-through.
 *
 * Sorting has no role gate: `sortBy`/`sortDir` must reach the model for BOTH
 * admin and kunde users. Kunde safety comes from row-scoping in the filter
 * layer, and unknown keys fall back via the `buildOrderByClause` whitelist
 * (covered in lib/__tests__/sqlSort.test.ts).
 */
import { orderController } from '../controllers/orderController.js';
import { orderModel } from '../models/orderModel.js';

jest.mock('../models/orderModel.js', () => ({
  orderModel: {
    findAll: jest.fn(),
    findByOrderNr: jest.fn(),
    findLines: jest.fn(),
    searchReferences: jest.fn(),
  },
}));

// jest.mock is hoisted: the imported binding IS the mock.
const mockFindAll = orderModel.findAll as unknown as jest.Mock;

function mockReqRes(user: Record<string, unknown>, query: Record<string, string>) {
  const req = { user, query } as any;
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;
  return { req, res };
}

describe('orderController.getAll — sort pass-through', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAll.mockResolvedValue({ data: [{ ordrenr: 10001 }], total: 1 });
  });

  it.each(['admin', 'kunde'])('forwards sortBy/sortDir for %s users', async (role) => {
    const user =
      role === 'admin'
        ? { id: 1, username: 'admin', role: 'admin' }
        : { id: 2, username: 'K001', role: 'kunde', kundenr: 'K001' };
    const { req, res } = mockReqRes(user, {
      page: '1',
      limit: '50',
      sortBy: 'sum',
      sortDir: 'asc',
    });

    await orderController.getAll(req, res);

    expect(mockFindAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'sum', sortDir: 'asc' }),
      user,
      { limit: 50, offset: 0 },
    );
    // And the paginated payload shape is preserved end to end.
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ ordrenr: 10001 }],
        pagination: expect.objectContaining({ total: 1 }),
      }),
    );
  });

  it('sorts nothing when no sort params are given', async () => {
    const user = { id: 2, username: 'K001', role: 'kunde', kundenr: 'K001' };
    const { req, res } = mockReqRes(user, { page: '2', limit: '50' });

    await orderController.getAll(req, res);

    expect(mockFindAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ sortBy: expect.anything() }),
      user,
      { limit: 50, offset: 50 },
    );
    expect(res.json).toHaveBeenCalled();
  });
});
