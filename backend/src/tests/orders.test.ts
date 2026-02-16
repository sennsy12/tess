import request from 'supertest';
import app from '../index';

// Mock dependencies
jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 1, role: 'admin', username: 'admin' };
    next();
  },
  roleGuard: () => (req: any, res: any, next: any) => next(),
}));

jest.mock('../models/orderModel', () => ({
  orderModel: {
    findAll: jest.fn(),
    findByOrderNr: jest.fn(),
    findLines: jest.fn(),
  },
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
    it('should return a single order with lines', async () => {
      const mockOrder = { ordrenr: 1, kundenr: '1000' };
      const mockLines = [{ linjenr: 1, varekode: 'ITEM1' }];
      
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue(mockOrder);
      (orderModel.findLines as jest.Mock).mockResolvedValue(mockLines);

      const res = await request(app).get('/api/orders/1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ordrenr', 1);
      expect(res.body).toHaveProperty('lines');
      expect(res.body.lines).toHaveLength(1);
    });

    it('should return 404 if order not found', async () => {
      (orderModel.findByOrderNr as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/orders/999');

      expect(res.status).toBe(404);
    });
  });
});
