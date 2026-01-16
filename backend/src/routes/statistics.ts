import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { statisticsController } from '../controllers/statisticsController.js';

export const statisticsRouter = Router();

// Statistics by customer (kunde)
statisticsRouter.get('/by-kunde', authMiddleware, statisticsController.getByKunde);

// Statistics by product group (varegruppe)
statisticsRouter.get('/by-varegruppe', authMiddleware, statisticsController.getByVaregruppe);

// Statistics by product (vare)
statisticsRouter.get('/by-vare', authMiddleware, statisticsController.getByVare);

// Statistics by warehouse (lager)
statisticsRouter.get('/by-lager', authMiddleware, statisticsController.getByLager);

// Statistics by company (firma)
statisticsRouter.get('/by-firma', authMiddleware, statisticsController.getByFirma);

// Time series statistics (orders over time)
statisticsRouter.get('/time-series', authMiddleware, statisticsController.getTimeSeries);

// Dashboard summary statistics
statisticsRouter.get('/summary', authMiddleware, statisticsController.getSummary);

// Custom self-service statistics
statisticsRouter.get('/custom', authMiddleware, statisticsController.getCustom);
