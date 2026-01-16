import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { customerController } from '../controllers/customerController.js';

export const customersRouter = Router();

// Get all customers
customersRouter.get('/', authMiddleware, customerController.getAll);

// Get single customer
customersRouter.get('/:kundenr', authMiddleware, customerController.getOne);
