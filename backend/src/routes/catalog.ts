import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { catalogController } from '../controllers/catalogController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, catalogQuerySchema } from '../middleware/validation.js';
import { searchLimiter } from '../middleware/rateLimit.js';

export const catalogRouter = Router();

// Customer-facing product catalog with per-customer prices
catalogRouter.get(
  '/products',
  authMiddleware,
  roleGuard('kunde', 'admin', 'analyse'),
  searchLimiter,
  validate(catalogQuerySchema, 'query'),
  asyncHandler(catalogController.list),
);
