import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { statisticsController } from '../controllers/statisticsController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validate,
  statisticsQuerySchema,
  statisticsTimeSeriesSchema,
  statisticsSummarySchema,
  statisticsCustomSchema,
} from '../middleware/validation.js';

export const statisticsRouter = Router();

// Statistics by customer (kunde)
statisticsRouter.get(
  '/by-kunde',
  authMiddleware,
  validate(statisticsQuerySchema, 'query'),
  asyncHandler(statisticsController.getByKunde)
);

// Statistics by product group (varegruppe)
statisticsRouter.get(
  '/by-varegruppe',
  authMiddleware,
  validate(statisticsQuerySchema, 'query'),
  asyncHandler(statisticsController.getByVaregruppe)
);

// Statistics by product (vare)
statisticsRouter.get(
  '/by-vare',
  authMiddleware,
  validate(statisticsQuerySchema, 'query'),
  asyncHandler(statisticsController.getByVare)
);

// Statistics by warehouse (lager)
statisticsRouter.get(
  '/by-lager',
  authMiddleware,
  validate(statisticsQuerySchema, 'query'),
  asyncHandler(statisticsController.getByLager)
);

// Statistics by company (firma)
statisticsRouter.get(
  '/by-firma',
  authMiddleware,
  validate(statisticsQuerySchema, 'query'),
  asyncHandler(statisticsController.getByFirma)
);

// Time series statistics (orders over time)
statisticsRouter.get(
  '/time-series',
  authMiddleware,
  validate(statisticsTimeSeriesSchema, 'query'),
  asyncHandler(statisticsController.getTimeSeries)
);

// Dashboard summary statistics
statisticsRouter.get(
  '/summary',
  authMiddleware,
  validate(statisticsSummarySchema, 'query'),
  asyncHandler(statisticsController.getSummary)
);

// Custom self-service statistics
statisticsRouter.get(
  '/custom',
  authMiddleware,
  validate(statisticsCustomSchema, 'query'),
  asyncHandler(statisticsController.getCustom)
);

// Batch stats for dashboards
statisticsRouter.get(
  '/batch',
  authMiddleware,
  validate(statisticsTimeSeriesSchema, 'query'),
  asyncHandler(statisticsController.getBatch)
);

