import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import {
  notificationController,
  notificationMarkReadController,
} from '../controllers/notificationController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validate,
  notificationQuerySchema,
  markNotificationsReadSchema,
} from '../middleware/validation.js';

export const notificationsRouter = Router();

notificationsRouter.use(authMiddleware);

notificationsRouter.get(
  '/',
  validate(notificationQuerySchema, 'query'),
  asyncHandler(notificationController.list),
);

notificationsRouter.get('/unread-count', asyncHandler(notificationController.unreadCount));

notificationsRouter.post(
  '/mark-read',
  validate(markNotificationsReadSchema),
  asyncHandler(notificationController.markRead),
);

notificationsRouter.post('/mark-all-read', asyncHandler(notificationController.markAllRead));

notificationsRouter.post('/:id/read', asyncHandler(notificationMarkReadController.markOne));
