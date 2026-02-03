import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { orderLineController } from '../controllers/orderLineController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const orderlinesRouter = Router();

// Get order lines for an order
orderlinesRouter.get('/order/:ordrenr', authMiddleware, asyncHandler(orderLineController.getByOrder));

// Create a new order line (admin only)
orderlinesRouter.post('/', authMiddleware, roleGuard('admin'), asyncHandler(orderLineController.create));

// Update an order line (admin only)
orderlinesRouter.put('/:ordrenr/:linjenr', authMiddleware, roleGuard('admin'), asyncHandler(orderLineController.update));

// Delete an order line (admin only)
orderlinesRouter.delete('/:ordrenr/:linjenr', authMiddleware, roleGuard('admin'), asyncHandler(orderLineController.delete));

// Update references for an order line (admin only)
orderlinesRouter.put('/:ordrenr/:linjenr/references', authMiddleware, roleGuard('admin'), asyncHandler(orderLineController.updateReferences));
