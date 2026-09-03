import request from 'supertest';
import app from '../index';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: 'admin', username: 'admin' };
    next();
  },
  roleGuard: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../models/notificationModel', () => ({
  notificationModel: {
    findForUser: jest.fn(),
    countUnread: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

import { notificationModel } from '../models/notificationModel';

describe('Notification Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('passes pagination through without filters', async () => {
      (notificationModel.findForUser as jest.Mock).mockResolvedValue({ data: [], total: 0 });

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(notificationModel.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.objectContaining({ limit: expect.any(Number), offset: 0 }),
        false,
        undefined,
      );
    });

    it('passes unreadOnly + type filters through', async () => {
      (notificationModel.findForUser as jest.Mock).mockResolvedValue({ data: [], total: 0 });

      const res = await request(app).get('/api/notifications?unreadOnly=true&type=order_status');

      expect(res.status).toBe(200);
      expect(notificationModel.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
        expect.anything(),
        true,
        'order_status',
      );
    });

    it('rejects overlong type values (zod)', async () => {
      const res = await request(app).get(`/api/notifications?type=${'x'.repeat(51)}`);

      expect(res.status).toBe(400);
      expect(notificationModel.findForUser).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('returns the unread count', async () => {
      (notificationModel.countUnread as jest.Mock).mockResolvedValue(3);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ count: 3 });
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('marks everything read', async () => {
      (notificationModel.markAllRead as jest.Mock).mockResolvedValue(5);

      const res = await request(app).post('/api/notifications/mark-all-read');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ marked: 5 });
    });
  });
});
