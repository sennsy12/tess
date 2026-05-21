import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { customerController } from '../controllers/customerController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const customersRouter = Router();

const auth = authMiddleware;
const adminOnly = roleGuard('admin');
const kundeProfileRoles = roleGuard('admin', 'kunde');

// Kunde portal: own company profile (must be before /:kundenr)
customersRouter.get('/me/profile', auth, kundeProfileRoles, asyncHandler(customerController.getMyProfile));

// Get all customers (admin only)
customersRouter.get('/', auth, adminOnly, asyncHandler(customerController.getAll));

// Get a single customer (admin only)
customersRouter.get('/:kundenr', auth, adminOnly, asyncHandler(customerController.getOne));
