import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { orderLineController } from '../controllers/orderLineController.js';

export const orderlinesRouter = Router();

// Get order lines for an order
orderlinesRouter.get('/order/:ordrenr', authMiddleware, orderLineController.getByOrder);

// Create order line (admin only)
orderlinesRouter.post('/', authMiddleware, roleGuard('admin'), orderLineController.create);

// Update order line (admin only)
orderlinesRouter.put('/:ordrenr/:linjenr', authMiddleware, roleGuard('admin'), orderLineController.update);

// Delete order line (admin only)
orderlinesRouter.delete('/:ordrenr/:linjenr', authMiddleware, roleGuard('admin'), orderLineController.delete);

// Update/Create references for order line (admin only)
orderlinesRouter.put('/:ordrenr/:linjenr/references', authMiddleware, roleGuard('admin'), orderLineController.updateReferences);
