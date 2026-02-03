import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { orderController } from '../controllers/orderController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, orderQuerySchema } from '../middleware/validation.js';

export const ordersRouter = Router();

// Get all orders (filtered by user role) with validated query params
ordersRouter.get('/', authMiddleware, validate(orderQuerySchema, 'query'), asyncHandler(orderController.getAll));

// Get a single order with lines
ordersRouter.get('/:ordrenr', authMiddleware, asyncHandler(orderController.getOne));

// Search order references
ordersRouter.get('/search/references', authMiddleware, asyncHandler(orderController.searchReferences));
