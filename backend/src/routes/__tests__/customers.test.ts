jest.mock('../../services/customerProfileService.js', () => ({
  customerProfileService: {
    getForAuthenticatedUser: jest.fn(),
    getByKundenr: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(String(req.headers['x-test-user']))
      : undefined;
    next();
  },
  roleGuard:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    },
}));

import request from 'supertest';
import express from 'express';
import { customersRouter } from '../customers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { customerProfileService } from '../../services/customerProfileService.js';
import { customerModel } from '../../models/customerModel.js';
import { ForbiddenError } from '../../middleware/errorHandler.js';

jest.mock('../../models/customerModel.js', () => ({
  customerModel: {
    findAll: jest.fn(),
    findByNumber: jest.fn(),
    findProfileByNumber: jest.fn(),
  },
}));

const mockGetProfile = customerProfileService.getForAuthenticatedUser as jest.Mock;
const mockFindByNumber = customerModel.findByNumber as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/customers', customersRouter);
  app.use(errorHandler);
  return app;
}

const sampleProfile = {
  kundenr: 'K001',
  kundenavn: 'Equinor ASA',
  customer_group_id: 2,
  customer_group_name: 'VIP',
  customer_group_description: 'Premium',
  portal_username: 'K001',
  account_created_at: '2024-01-01T00:00:00.000Z',
  primary_firma: 'TESS Norge AS',
  primary_lager: 'Oslo',
  contact_refs: ['Ola Nordmann'],
  stats: {
    order_count: 10,
    total_revenue: 500000,
    active_orders: 2,
    first_order_date: '2023-01-01',
    last_order_date: '2025-01-01',
  },
};

describe('customers routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/customers/me/profile', () => {
    it('returns profile for authenticated kunde', async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/me/profile')
        .set(
          'x-test-user',
          JSON.stringify({ id: 1, username: 'K001', role: 'kunde', kundenr: 'K001' }),
        );

      expect(res.status).toBe(200);
      expect(res.body.kundenr).toBe('K001');
      expect(res.body.stats.order_count).toBe(10);
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
    });

    it('returns 403 when kunde has no linked kundenr', async () => {
      mockGetProfile.mockRejectedValueOnce(
        new ForbiddenError('No customer account linked to this user'),
      );
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/me/profile')
        .set('x-test-user', JSON.stringify({ id: 1, username: 'k1', role: 'kunde' }));

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/customer account/i);
    });

    it('does not treat "me" as a kundenr param (route ordering)', async () => {
      mockGetProfile.mockResolvedValueOnce(sampleProfile);
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/me/profile')
        .set(
          'x-test-user',
          JSON.stringify({ id: 1, username: 'K001', role: 'kunde', kundenr: 'K001' }),
        );

      expect(res.status).toBe(200);
      expect(mockFindByNumber).not.toHaveBeenCalled();
      expect(mockGetProfile).toHaveBeenCalled();
    });

    it('denies analyse role', async () => {
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/me/profile')
        .set('x-test-user', JSON.stringify({ id: 2, username: 'analyst', role: 'analyse' }));

      expect(res.status).toBe(403);
      expect(mockGetProfile).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/customers/:kundenr', () => {
    it('remains admin-only and separate from /me/profile', async () => {
      mockFindByNumber.mockResolvedValueOnce({ kundenr: 'K002', kundenavn: 'Aker' });
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/K002')
        .set('x-test-user', JSON.stringify({ id: 1, username: 'admin', role: 'admin' }));

      expect(res.status).toBe(200);
      expect(res.body.kundenr).toBe('K002');
      expect(mockGetProfile).not.toHaveBeenCalled();
    });

    it('denies kunde from fetching arbitrary customer by kundenr', async () => {
      const app = buildApp();

      const res = await request(app)
        .get('/api/customers/K002')
        .set(
          'x-test-user',
          JSON.stringify({ id: 1, username: 'K001', role: 'kunde', kundenr: 'K001' }),
        );

      expect(res.status).toBe(403);
      expect(mockFindByNumber).not.toHaveBeenCalled();
    });
  });
});
