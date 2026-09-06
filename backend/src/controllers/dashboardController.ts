import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statisticsModel } from '../models/statisticsModel.js';
import { statusModel } from '../models/statusModel.js';
import { priceRuleModel } from '../models/pricingModel.js';
import { getJobLogs, getAllJobs } from '../scheduler/index.js';

// Navngitte konstanter for tidligere inline magiske tall (samme verdier/oppførsel).
// Ingen rute flyttes; kun lesbarhet. Fallback-semantikk (`|| DEFAULT`) beholdes.
const DASHBOARD_TOP_LIMIT = 10;
const DASHBOARD_TOP_MAX_LIMIT = 200;
const DASHBOARD_ACTIVITY_DAYS = 7;
const DASHBOARD_SCHEDULER_LOG_LIMIT = 20;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Optional date-range passthrough for top-N widgets. Only well-formed
 * YYYY-MM-DD values are forwarded (dashboard routes carry no zod date
 * validation); anything else falls back to the historic unfiltered default.
 */
function pickTopDateFilters(
  q: unknown,
): { startDate?: string; endDate?: string } | undefined {
  const query = q as Record<string, unknown>;
  const startDate = typeof query.startDate === 'string' && DATE_RE.test(query.startDate) ? query.startDate : undefined;
  const endDate = typeof query.endDate === 'string' && DATE_RE.test(query.endDate) ? query.endDate : undefined;
  if (!startDate && !endDate) return undefined;
  return { startDate, endDate };
}

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
      statisticsModel.getTopProducts(DASHBOARD_TOP_LIMIT),
      statisticsModel.getTopCustomers(DASHBOARD_TOP_LIMIT),
      statisticsModel.getSummary({}),
      statusModel.getRecentActivity(DASHBOARD_ACTIVITY_DAYS),
      priceRuleModel.getPriceDeviations(DASHBOARD_TOP_LIMIT),
      getAllJobs(),
      getJobLogs(undefined, DASHBOARD_SCHEDULER_LOG_LIMIT),
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
    // Capped at 200 to block runaway scans; optional YYYY-MM-DD date
    // passthrough (absent/invalid = historic unfiltered behaviour).
    const limit = Math.min(parseInt(req.query.limit as string) || DASHBOARD_TOP_LIMIT, DASHBOARD_TOP_MAX_LIMIT);
    const data = await statisticsModel.getTopProducts(limit, pickTopDateFilters(req.query));
    res.json(data);
  },

  /**
   * Get top customers widget data
   */
  getTopCustomers: async (req: AuthRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || DASHBOARD_TOP_LIMIT, DASHBOARD_TOP_MAX_LIMIT);
    const data = await statisticsModel.getTopCustomers(limit, pickTopDateFilters(req.query));
    res.json(data);
  },

  /**
   * Get price deviations widget data
   */
  getPriceDeviations: async (req: AuthRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || DASHBOARD_TOP_LIMIT;
    const data = await priceRuleModel.getPriceDeviations(limit);
    res.json(data);
  },

  /**
   * Get ETL/data freshness status
   */
  getDataStatus: async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || DASHBOARD_ACTIVITY_DAYS;
    const data = await statusModel.getRecentActivity(days);
    res.json(data);
  },
};
