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

  describe('POST /api/notifications/mark-read', () => {
    it('marks selected ids read', async () => {
      (notificationModel.markRead as jest.Mock).mockResolvedValue(2);

      const res = await request(app).post('/api/notifications/mark-read').send({ ids: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ marked: 2 });
      // Robust to concurrent markRead(user|userId, ids) signature churn:
      // ids-arg must match; user-arg must identify user 1 in either form.
      const call = (notificationModel.markRead as jest.Mock).mock.calls[0];
      expect(call[1]).toEqual([1, 2]);
      expect(call[0] === 1 || (typeof call[0] === 'object' && call[0] !== null && call[0].id === 1)).toBe(true);
    });

    it('rejects empty ids with 400 (zod)', async () => {
      const res = await request(app).post('/api/notifications/mark-read').send({ ids: [] });

      expect(res.status).toBe(400);
      expect(notificationModel.markRead).not.toHaveBeenCalled();
    });

    it('rejects missing ids with 400 (zod)', async () => {
      const res = await request(app).post('/api/notifications/mark-read').send({});

      expect(res.status).toBe(400);
      expect(notificationModel.markRead).not.toHaveBeenCalled();
    });

    it('rejects non-positive ids with 400 (zod)', async () => {
      const res = await request(app).post('/api/notifications/mark-read').send({ ids: [0, -1] });

      expect(res.status).toBe(400);
      expect(notificationModel.markRead).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    it('marks a single notification read', async () => {
      (notificationModel.markRead as jest.Mock).mockResolvedValue(1);

      const res = await request(app).post('/api/notifications/42/read');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      const call = (notificationModel.markRead as jest.Mock).mock.calls[0];
      expect(call[1]).toEqual([42]);
      expect(call[0] === 1 || (typeof call[0] === 'object' && call[0] !== null && call[0].id === 1)).toBe(true);
    });

    it('rejects non-numeric id with 400', async () => {
      const res = await request(app).post('/api/notifications/abc/read');

      expect(res.status).toBe(400);
      expect(notificationModel.markRead).not.toHaveBeenCalled();
    });

    it('rejects zero/negative id with 400', async () => {
      const resZero = await request(app).post('/api/notifications/0/read');
      expect(resZero.status).toBe(400);

      const resNeg = await request(app).post('/api/notifications/-5/read');
      expect(resNeg.status).toBe(400);

      expect(notificationModel.markRead).not.toHaveBeenCalled();
    });
  });
});
