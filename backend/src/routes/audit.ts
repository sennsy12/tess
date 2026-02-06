import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { auditController } from '../controllers/auditController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const auditRouter = Router();

// All audit routes require admin role
auditRouter.use(authMiddleware, roleGuard('admin'));

// Get paginated audit log entries
auditRouter.get('/', asyncHandler(auditController.getAll));

// Get audit history for a specific entity
auditRouter.get('/:entityType/:entityId', asyncHandler(auditController.getByEntity));
