import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { reportController } from '../controllers/reportController.js';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

reportsRouter.get('/', reportController.getReports);
reportsRouter.post('/', reportController.saveReport);
reportsRouter.delete('/:id', reportController.deleteReport);
