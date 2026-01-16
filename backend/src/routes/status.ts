import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { statusController } from '../controllers/statusController.js';

export const statusRouter = Router();

// Get system status (admin only)
statusRouter.get('/', authMiddleware, roleGuard('admin'), statusController.getSystemStatus);

// Get data import status (admin only)
statusRouter.get('/import', authMiddleware, roleGuard('admin'), statusController.getImportStatus);

// Get data extraction status (admin only)
statusRouter.get('/extraction', authMiddleware, roleGuard('admin'), statusController.getExtractionStatus);

// Get frontend/backend health (admin only)
statusRouter.get('/health', authMiddleware, roleGuard('admin'), statusController.getHealth);
