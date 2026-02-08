import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { auditController } from '../controllers/auditController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, paginationSchema } from '../middleware/validation.js';
import { z } from 'zod';

export const auditRouter = Router();

// Audit routes require authentication
auditRouter.use(authMiddleware);

// Schema for audit log filtering
const auditQuerySchema = paginationSchema.extend({
  entity_type: z.string().optional(),
  action: z.string().optional(),
  user_id: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Get paginated audit log entries
auditRouter.get('/', validate(auditQuerySchema, 'query'), asyncHandler(auditController.getAll));

// Get audit history for a specific entity
auditRouter.get('/:entityType/:entityId', asyncHandler(auditController.getByEntity));
