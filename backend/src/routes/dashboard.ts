import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const dashboardRouter = Router();

// All dashboard routes require admin access
dashboardRouter.use(authMiddleware, roleGuard('admin'));

// Get all widget data in one call (optimized)
dashboardRouter.get('/widgets', asyncHandler(dashboardController.getWidgets));

// Batch analytics for admin dashboards
dashboardRouter.get('/analytics', asyncHandler(dashboardController.getAnalyticsBatch));

// Individual widget endpoints (for lazy loading / refresh)
dashboardRouter.get('/top-products', asyncHandler(dashboardController.getTopProducts));
dashboardRouter.get('/top-customers', asyncHandler(dashboardController.getTopCustomers));
dashboardRouter.get('/price-deviations', asyncHandler(dashboardController.getPriceDeviations));
dashboardRouter.get('/data-status', asyncHandler(dashboardController.getDataStatus));
