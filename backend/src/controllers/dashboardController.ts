import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statisticsModel } from '../models/statisticsModel.js';
import { statusModel } from '../models/statusModel.js';
import { priceRuleModel } from '../models/pricingModel.js';
import { getJobLogs, getAllJobs } from '../scheduler/index.js';

export const dashboardController = {
  /**
   * Get all dashboard widget data in one optimized call
   */
  getWidgets: async (req: AuthRequest, res: Response) => {
    const [
      topProducts,
      topCustomers,
      summary,
      recentActivity,
      priceDeviations,
      schedulerJobs,
      schedulerLogs,
    ] = await Promise.all([
      statisticsModel.getTopProducts(10),
      statisticsModel.getTopCustomers(10),
      statisticsModel.getSummary({}),
      statusModel.getRecentActivity(7),
      priceRuleModel.getPriceDeviations(10),
      getAllJobs(),
      getJobLogs(undefined, 20),
    ]);

    res.json({
      topProducts,
      topCustomers,
      summary,
      recentActivity,
      priceDeviations,
      schedulerStatus: {
        jobs: schedulerJobs,
        recentLogs: schedulerLogs,
      },
    });
  },

  /**
   * Batch analytics for admin dashboards
   */
  getAnalyticsBatch: async (req: AuthRequest, res: Response) => {
    const [summary, timeSeries, firma, lager] = await Promise.all([
      statisticsModel.getSummary({}),
      statisticsModel.getTimeSeries({ groupBy: 'month' }),
      statisticsModel.getByFirma({}),
      statisticsModel.getByLager({}),
    ]);

    res.json({
      summary,
      timeSeries,
      firma,
      lager,
    });
  },

  /**
   * Get top products widget data
   */
  getTopProducts: async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await statisticsModel.getTopProducts(limit);
    res.json(data);
  },

  /**
   * Get top customers widget data
   */
  getTopCustomers: async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await statisticsModel.getTopCustomers(limit);
    res.json(data);
  },

  /**
   * Get price deviations widget data
   */
  getPriceDeviations: async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await priceRuleModel.getPriceDeviations(limit);
    res.json(data);
  },

  /**
   * Get ETL/data freshness status
   */
  getDataStatus: async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const data = await statusModel.getRecentActivity(days);
    res.json(data);
  },
};
