import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { notificationModel } from '../models/notificationModel.js';
import { buildListResponse } from '../lib/listResponse.js';
import {
  markNotificationsReadSchema,
  notificationQuerySchema,
} from '../middleware/validation.js';
import { ValidationError } from '../middleware/errorHandler.js';

export const notificationController = {
  list: async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { page, limit, unreadOnly, type } = req.query as unknown as z.infer<typeof notificationQuerySchema>;
    const offset = (page - 1) * limit;

    const result = await notificationModel.findForUser(req.user, { limit, offset }, unreadOnly, type);

    res.json(
      buildListResponse(result.data, { page, limit, total: result.total }),
    );
  },

  unreadCount: async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const count = await notificationModel.countUnread(req.user);
    res.json({ count });
  },

  markRead: async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { ids } = req.body as z.infer<typeof markNotificationsReadSchema>;
    const marked = await notificationModel.markRead(req.user.id, ids);
    res.json({ marked });
  },

  markAllRead: async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const marked = await notificationModel.markAllRead(req.user);
    res.json({ marked });
  },
};

export const notificationMarkReadController = {
  markOne: async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      throw new ValidationError('Invalid notification id');
    }

    await notificationModel.markRead(req.user.id, [id]);
    res.json({ ok: true });
  },
};
