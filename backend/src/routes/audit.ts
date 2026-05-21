import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { auditController } from '../controllers/auditController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, auditQuerySchema } from '../middleware/validation.js';

export const auditRouter = Router();

auditRouter.use(authMiddleware, roleGuard('admin'));

auditRouter.get('/', validate(auditQuerySchema, 'query'), asyncHandler(auditController.getAll));

auditRouter.get('/:entityType/:entityId', asyncHandler(auditController.getByEntity));
