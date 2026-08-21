/**
 * Route tests for customer order placement:
 *   POST /api/orders        (kunde places an order from the cart)
 *   PATCH /api/orders/:ordrenr/cancel (owning kunde or admin)
 */
import request from 'supertest';

jest.mock('../middleware/auth', () => {
  let currentUser: { id: number; username: string; role: string; kundenr?: string } | null = null;
  return {
    __setCurrentUser: (u: typeof currentUser) => { currentUser = u; },
    authMiddleware: (req: any, _res: any, next: any) => {
      if (!currentUser) return next(new Error('unauthenticated'));
      req.user = currentUser;
      next();
    },
    roleGuard: (...roles: string[]) => (_req: any, res: any, next: any) => {
      if (!currentUser) return res.status(401).json({ error: 'No token provided' });
      if (roles.length > 0 && !roles.includes(currentUser!.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    },
  };
});

jest.mock('../services/orderPlacementService.js', () => ({
  orderPlacementService: { createOrder: jest.fn() },
}));
jest.mock('../services/notificationService.js', () => ({
  notifyOrderSubmitted: jest.fn().mockResolvedValue(undefined),
  notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/auditService.js', () => ({
  auditService: { log: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../models/orderModel.js', () => ({
  orderModel: {
    findByOrderNr: jest.fn(),
    cancelByOwner: jest.fn(),
    findAll: jest.fn(),
    findLines: jest.fn(),
    updateWorkflowStatus: jest.fn(),
    searchReferences: jest.fn(),
  },
}));

import app from '../index';
import { orderPlacementService } from '../services/orderPlacementService';
import { orderModel } from '../models/orderModel';

const authMock = jest.requireMock('../middleware/auth') as {
  __setCurrentUser: (u: Record<string, unknown> | null) => void;
};
const __setCurrentUser = authMock.__setCurrentUser;

const mockedCreate = orderPlacementService.createOrder as jest.Mock;
const mockedFindByOrderNr = orderModel.findByOrderNr as jest.Mock;
const mockedCancelByOwner = orderModel.cancelByOwner as jest.Mock;

const kundeUser = { id: 2, username: 'K001', role: 'kunde', kundenr: 'K001' };
const adminUser = { id: 1, username: 'admin', role: 'admin' };

const validBody = {
  items: [{ varekode: 'V-1000', antall: 5 }],
  idempotencyKey: 'test-key-12345678',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/orders', () => {
  it('creates an order for a kunde user and notifies admins', async () => {
    __setCurrentUser(kundeUser);
    mockedCreate.mockResolvedValue({
      ordrenr: 10042,
      kundenr: 'K001',
      workflow_status: 'pending_approval',
      sum: 500,
      duplicate: false,
    });

    const res = await request(app).post('/api/orders').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.ordrenr).toBe(10042);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kundenr: 'K001', idempotencyKey: 'test-key-12345678' }),
    );
  });

  it('returns 200 (not 201) on idempotent replay', async () => {
    __setCurrentUser(kundeUser);
    mockedCreate.mockResolvedValue({
      ordrenr: 10042, kundenr: 'K001', workflow_status: 'pending_approval', sum: 500, duplicate: true,
    });

    const res = await request(app).post('/api/orders').send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
  });

  it('rejects empty item list with 400', async () => {
    __setCurrentUser(kundeUser);
    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, items: [] });

    expect(res.status).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate varekode entries with 400', async () => {
    __setCurrentUser(kundeUser);
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [
          { varekode: 'V-1000', antall: 1 },
          { varekode: 'V-1000', antall: 2 },
        ],
        idempotencyKey: 'test-key-12345678',
      });

    expect(res.status).toBe(400);
  });

  it('rejects analyse users with 403', async () => {
    __setCurrentUser({ id: 3, username: 'analyse', role: 'analyse' });
    const res = await request(app).post('/api/orders').send(validBody);
    expect(res.status).toBe(403);
  });

  it('requires kundenr when an admin places the order', async () => {
    __setCurrentUser(adminUser);
    const res = await request(app).post('/api/orders').send(validBody);
    expect(res.status).toBe(400);
  });

  it('allows admin to place an order on behalf of a kunde', async () => {
    __setCurrentUser(adminUser);
    mockedCreate.mockResolvedValue({
      ordrenr: 10043, kundenr: 'K002', workflow_status: 'pending_approval', sum: 10, duplicate: false,
    });

    const res = await request(app)
      .post('/api/orders')
      .send({ ...validBody, kundenr: 'K002' });

    expect(res.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kundenr: 'K002' }),
    );
  });
});

describe('PATCH /api/orders/:ordrenr/cancel', () => {
  it('lets the owning kunde cancel a pending order', async () => {
    __setCurrentUser(kundeUser);
    mockedFindByOrderNr.mockResolvedValue({ ordrenr: 10042, workflow_status: 'pending_approval' });
    mockedCancelByOwner.mockResolvedValue({ ordrenr: 10042, kundenr: 'K001', workflow_status: 'cancelled' });

    const res = await request(app).patch('/api/orders/10042/cancel');

    expect(res.status).toBe(200);
    expect(res.body.workflow_status).toBe('cancelled');
    expect(orderModel.cancelByOwner).toHaveBeenCalledWith(10042, kundeUser);
  });

  it('rejects cancelling an order already in processing', async () => {
    __setCurrentUser(kundeUser);
    mockedFindByOrderNr.mockResolvedValue({ ordrenr: 10042, workflow_status: 'processing' });

    const res = await request(app).patch('/api/orders/10042/cancel');

    expect(res.status).toBe(400);
    expect(orderModel.cancelByOwner).not.toHaveBeenCalled();
  });

  it('returns 404 when the kunde does not own the order', async () => {
    __setCurrentUser(kundeUser);
    mockedFindByOrderNr.mockResolvedValue(undefined);

    const res = await request(app).patch('/api/orders/99999/cancel');

    expect(res.status).toBe(404);
  });
});
