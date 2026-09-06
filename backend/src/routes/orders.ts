import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { orderController } from '../controllers/orderController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, orderQuerySchema, searchQuerySchema, updateOrderStatusSchema, createOrderSchema, ordrenrParamSchema } from '../middleware/validation.js';
import { orderCreateLimiter } from '../middleware/rateLimit.js';

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

// Place a customer order from the cart (kunde; admin may act on behalf)
ordersRouter.post(
  '/',
  authMiddleware,
  roleGuard('kunde', 'admin'),
  orderCreateLimiter,
  validate(createOrderSchema),
  asyncHandler(orderController.create),
);

// Cancel an order awaiting approval (owning kunde or admin)
ordersRouter.patch(
  '/:ordrenr/cancel',
  authMiddleware,
  roleGuard('kunde', 'admin'),
  validate(ordrenrParamSchema, 'params'),
  asyncHandler(orderController.cancel),
);

// Update order workflow status (admin only)
ordersRouter.patch(
  '/:ordrenr/status',
  authMiddleware,
  roleGuard('admin'),
  validate(ordrenrParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  asyncHandler(orderController.updateStatus),
);

// Get workflow history (timeline: who/when/from→to/comment), kunde-scoped
// (invalid ordrenr → 400 via params; unknown/foreign → 404 in service)
ordersRouter.get(
  '/:ordrenr/history',
  authMiddleware,
  validate(ordrenrParamSchema, 'params'),
  asyncHandler(orderController.getHistory),
);

// Get a single order with lines
// (invalid ordrenr → 400 via params; unknown/foreign → 404 in controller)
ordersRouter.get(
  '/:ordrenr',
  authMiddleware,
  validate(ordrenrParamSchema, 'params'),
  asyncHandler(orderController.getOne),
);
