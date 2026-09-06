import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { orderLineController } from '../controllers/orderLineController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validate,
  orderLineSchema,
  updateOrderLineSchema,
  ordrenrParamSchema,
  orderLineParamsSchema,
} from '../middleware/validation.js';

export const orderlinesRouter = Router();

// Get order lines for an order (kunde-scoped in controller; unknown/foreign → 404)
orderlinesRouter.get(
  '/order/:ordrenr',
  authMiddleware,
  validate(ordrenrParamSchema, 'params'),
  asyncHandler(orderLineController.getByOrder),
);

// Create a new order line (admin only)
orderlinesRouter.post(
  '/',
  authMiddleware,
  roleGuard('admin'),
  validate(orderLineSchema),
  asyncHandler(orderLineController.create),
);

// Update an order line (admin only)
orderlinesRouter.put(
  '/:ordrenr/:linjenr',
  authMiddleware,
  roleGuard('admin'),
  validate(orderLineParamsSchema, 'params'),
  validate(updateOrderLineSchema),
  asyncHandler(orderLineController.update),
);

// Delete an order line (admin only)
orderlinesRouter.delete(
  '/:ordrenr/:linjenr',
  authMiddleware,
  roleGuard('admin'),
  validate(orderLineParamsSchema, 'params'),
  asyncHandler(orderLineController.delete),
);

// Update references for an order line (admin only)
orderlinesRouter.put(
  '/:ordrenr/:linjenr/references',
  authMiddleware,
  roleGuard('admin'),
  validate(orderLineParamsSchema, 'params'),
  asyncHandler(orderLineController.updateReferences),
);
