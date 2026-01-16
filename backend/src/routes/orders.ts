import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { orderController } from '../controllers/orderController.js';

export const ordersRouter = Router();

// Get all orders (with filters)
ordersRouter.get('/', authMiddleware, orderController.getAll);

// Search orders by references (henvisning)
ordersRouter.get('/search/references', authMiddleware, orderController.searchReferences);

// Get single order by ordrenr
ordersRouter.get('/:ordrenr', authMiddleware, orderController.getOne);
