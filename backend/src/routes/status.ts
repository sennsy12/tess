import { Router, Request, Response } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { statusController } from '../controllers/statusController.js';
import { getApiMetrics, getApiMetricsSummary } from '../middleware/apiMetrics.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const statusRouter = Router();

// Get system status (admin only)
statusRouter.get('/', authMiddleware, roleGuard('admin'), asyncHandler(statusController.getSystemStatus));

// Get data import status (admin only)
statusRouter.get('/import', authMiddleware, roleGuard('admin'), asyncHandler(statusController.getImportStatus));

// Get data extraction status (admin only)
statusRouter.get('/extraction', authMiddleware, roleGuard('admin'), asyncHandler(statusController.getExtractionStatus));

// Get frontend/backend health (admin only)
statusRouter.get('/health', authMiddleware, roleGuard('admin'), asyncHandler(statusController.getHealth));

// Get API performance metrics (admin only)
statusRouter.get('/api-metrics', authMiddleware, roleGuard('admin'), asyncHandler(async (req: Request, res: Response) => {
  res.json({
    summary: getApiMetricsSummary(),
    endpoints: getApiMetrics()
  });
}));



