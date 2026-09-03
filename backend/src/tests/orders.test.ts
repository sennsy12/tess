import request from 'supertest';
import app from '../index';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin', username: 'admin' };
    next();
  },
  roleGuard: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../models/orderModel', () => ({
  orderModel: {
    findAll: jest.fn(),
    findByOrderNr: jest.fn(),
    findLines: jest.fn(),
    updateWorkflowStatus: jest.fn(),
    transitionWithHistory: jest.fn(),
    listHistory: jest.fn(),
    appendHistory: jest.fn().mockResolvedValue(undefined),
    cancelByOwner: jest.fn(),
    searchReferences: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../services/notificationService.js', () => ({
  notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/orderEvents.js', () => ({
  publishOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
  publishOrderSubmitted: jest.fn().mockResolvedValue(undefined),
}));

import { orderModel } from '../models/orderModel';
import { publishOrderStatusChanged } from '../services/orderEvents.js';

describe('Order Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orders', () => {
    it('should return a list of orders', async () => {
      const mockOrders = {
        data: [{ ordrenr: 1, kundenr: '1000' }],
        total: 1,
      };
      (orderModel.findAll as jest.Mock).mockResolvedValue(mockOrders);

      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('ordrenr', 1);
    });
  });

  describe('GET /api/orders/:ordrenr', () => {
    it('should return a single order with lines and lineSummary', async () => {
      const mockOrder = { ordrenr: 1, kundenr: '1000' };
      const mockLines = [{ linjenr: 1, varekode: 'ITEM1', antall: 2, nettpris: 100, linjesum: 200 }];

      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue(mockOrder);
      (orderModel.findLines as jest.Mock).mockResolvedValue(mockLines);

      const res = await request(app).get('/api/orders/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ordrenr', 1);
      expect(res.body).toHaveProperty('lines');
      expect(res.body).toHaveProperty('lineSummary');
      expect(res.body.lineSummary.netto).toBe(200);
    });

    it('should return 404 if order not found', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/orders/999');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/orders/:ordrenr/status', () => {
    it('rejects illegal workflow transitions', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 1,
        kundenr: '1000',
        workflow_status: 'new',
      });

      const res = await request(app)
        .patch('/api/orders/1/status')
        .send({ workflowStatus: 'invoiced' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/statusovergang/i);
      expect(orderModel.transitionWithHistory).not.toHaveBeenCalled();
      expect(orderModel.updateWorkflowStatus).not.toHaveBeenCalled();
    });

    it('allows valid workflow transitions (atomic path with history)', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 1,
        kundenr: '1000',
        workflow_status: 'new',
      });
      (orderModel.transitionWithHistory as jest.Mock).mockResolvedValue({
        ordrenr: 1,
        kundenr: '1000',
        workflow_status: 'processing',
      });

      const res = await request(app)
        .patch('/api/orders/1/status')
        .send({ workflowStatus: 'processing' });

      expect(res.status).toBe(200);
      expect(orderModel.transitionWithHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          ordrenr: 1,
          previousStatus: 'new',
          newStatus: 'processing',
          changedByUsername: 'admin',
        }),
      );
      expect(publishOrderStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ ordrenr: 1, previousStatus: 'new', newStatus: 'processing' }),
      );
    });

    it('requires a comment when rejecting', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 2,
        kundenr: '1000',
        workflow_status: 'pending_approval',
      });

      const res = await request(app)
        .patch('/api/orders/2/status')
        .send({ workflowStatus: 'rejected' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/begrunnelse/i);
      expect(orderModel.transitionWithHistory).not.toHaveBeenCalled();
    });

    it('passes the decision comment to history + notifications', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 2,
        kundenr: '1000',
        workflow_status: 'pending_approval',
      });
      (orderModel.transitionWithHistory as jest.Mock).mockResolvedValue({
        ordrenr: 2,
        kundenr: '1000',
        workflow_status: 'rejected',
      });

      const res = await request(app)
        .patch('/api/orders/2/status')
        .send({ workflowStatus: 'rejected', comment: 'Feil pris, kontakt selger' });

      expect(res.status).toBe(200);
      expect(orderModel.transitionWithHistory).toHaveBeenCalledWith(
        expect.objectContaining({ newStatus: 'rejected', comment: 'Feil pris, kontakt selger' }),
      );
      expect(publishOrderStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ comment: 'Feil pris, kontakt selger' }),
      );
    });

    it('rejects comments over 500 chars (zod)', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 2,
        kundenr: '1000',
        workflow_status: 'pending_approval',
      });

      const res = await request(app)
        .patch('/api/orders/2/status')
        .send({ workflowStatus: 'approved', comment: 'x'.repeat(501) });

      expect(res.status).toBe(400);
      expect(orderModel.transitionWithHistory).not.toHaveBeenCalled();
    });

    it('maps concurrent modification to 409', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 3,
        kundenr: '1000',
        workflow_status: 'pending_approval',
      });
      const race = new Error('Ordren ble endret av noen andre') as Error & { statusCode: number };
      race.statusCode = 409;
      (orderModel.transitionWithHistory as jest.Mock).mockRejectedValue(race);

      const res = await request(app)
        .patch('/api/orders/3/status')
        .send({ workflowStatus: 'approved' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/orders/:ordrenr/history', () => {
    it('returns the workflow timeline', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 7,
        kundenr: '1000',
        workflow_status: 'approved',
      });
      (orderModel.listHistory as jest.Mock).mockResolvedValue([
        {
          id: 1,
          ordrenr: 7,
          previous_status: 'pending_approval',
          new_status: 'approved',
          changed_by_username: 'admin',
          changed_by_role: 'admin',
          comment: null,
          created_at: new Date().toISOString(),
        },
      ]);

      const res = await request(app).get('/api/orders/7/history');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('new_status', 'approved');
      expect(orderModel.listHistory).toHaveBeenCalledWith(7);
    });

    it('returns 404 for unknown orders (also hides foreign kunde orders)', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/orders/999/history');

      expect(res.status).toBe(404);
      expect(orderModel.listHistory).not.toHaveBeenCalled();
    });
  });
});
