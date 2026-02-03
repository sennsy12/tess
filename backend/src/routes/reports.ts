import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { reportController } from '../controllers/reportController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

reportsRouter.get('/', asyncHandler(reportController.getReports));
reportsRouter.post('/', asyncHandler(reportController.saveReport));
reportsRouter.delete('/:id', asyncHandler(reportController.deleteReport));

