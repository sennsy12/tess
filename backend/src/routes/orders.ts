import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { orderController } from '../controllers/orderController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, orderQuerySchema, searchQuerySchema, updateOrderStatusSchema } from '../middleware/validation.js';

export const ordersRouter = Router();

// Get all orders (filtered by user role) with validated query params
ordersRouter.get('/', authMiddleware, validate(orderQuerySchema, 'query'), asyncHandler(orderController.getAll));

// Workflow status metadata
ordersRouter.get('/statuses', authMiddleware, asyncHandler(orderController.listStatuses));

// Search order references (must be registered before /:ordrenr)
ordersRouter.get(
  '/search/references',
  authMiddleware,
  validate(searchQuerySchema, 'query'),
  asyncHandler(orderController.searchReferences),
);

// Update order workflow status (admin only)
ordersRouter.patch(
  '/:ordrenr/status',
  authMiddleware,
  roleGuard('admin'),
  validate(updateOrderStatusSchema),
  asyncHandler(orderController.updateStatus),
);

// Get a single order with lines
ordersRouter.get('/:ordrenr', authMiddleware, asyncHandler(orderController.getOne));
