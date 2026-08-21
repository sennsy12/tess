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
  },
}));

jest.mock('../services/notificationService.js', () => ({
  notifyOrderStatusChange: jest.fn().mockResolvedValue(undefined),
}));

import { orderModel } from '../models/orderModel';

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
      expect(orderModel.updateWorkflowStatus).not.toHaveBeenCalled();
    });

    it('allows valid workflow transitions', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue({
        ordrenr: 1,
        kundenr: '1000',
        workflow_status: 'new',
      });
      (orderModel.updateWorkflowStatus as jest.Mock).mockResolvedValue({
        ordrenr: 1,
        kundenr: '1000',
        workflow_status: 'processing',
      });

      const res = await request(app)
        .patch('/api/orders/1/status')
        .send({ workflowStatus: 'processing' });

      expect(res.status).toBe(200);
      expect(orderModel.updateWorkflowStatus).toHaveBeenCalledWith(1, 'processing');
    });
  });
});
