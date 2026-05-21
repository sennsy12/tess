import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { assistantLimiter } from '../middleware/rateLimit.js';
import { assistantController } from '../controllers/assistantController.js';
import { assistantChatBodySchema } from '../assistant/validation.js';

export const assistantRouter = Router();

assistantRouter.use(authMiddleware);

assistantRouter.get('/status', asyncHandler(assistantController.status));

assistantRouter.post(
  '/chat',
  assistantLimiter,
  validate(assistantChatBodySchema, 'body'),
  asyncHandler(assistantController.chat)
);
