import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { customerController } from '../controllers/customerController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const customersRouter = Router();

// Get all customers (admin only)
customersRouter.get('/', authMiddleware, roleGuard('admin'), asyncHandler(customerController.getAll));

// Get a single customer (admin only)
customersRouter.get('/:kundenr', authMiddleware, roleGuard('admin'), asyncHandler(customerController.getOne));
