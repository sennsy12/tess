import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statisticsModel, StatsFilters } from '../models/statisticsModel.js';
import { ValidationError } from '../middleware/errorHandler.js';

const parseFilters = (query: any): StatsFilters => ({
  startDate: query.startDate,
  endDate: query.endDate,
  varegruppe: query.varegruppe,
  kundenr: query.kundenr,
  groupBy: query.groupBy,
  page: query.page ? parseInt(query.page, 10) : 1,
  limit: query.limit ? Math.min(parseInt(query.limit, 10), 100) : 25, // Max 100 per page
});

/**
 * For kunde users, force the kundenr filter so they only see their own data.
 * Admin / analyse users can optionally pass kundenr as a query parameter.
 */
const applyUserScope = (filters: StatsFilters, user?: AuthRequest['user']): StatsFilters => {
  if (user?.role === 'kunde' && user?.kundenr) {
    return { ...filters, kundenr: user.kundenr };
  }
  return filters;
};

export const statisticsController = {
  getByKunde: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const result = await statisticsModel.getByKunde(filters);
    res.json(result);
  },

  getByVaregruppe: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const result = await statisticsModel.getByVaregruppe(filters);
    res.json(result);
  },

  getByVare: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const result = await statisticsModel.getByVare(filters);
    res.json(result);
  },

  getByLager: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const result = await statisticsModel.getByLager(filters);
    res.json(result);
  },

  getByFirma: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const result = await statisticsModel.getByFirma(filters);
    res.json(result);
  },

  getTimeSeries: async (req: AuthRequest, res: Response) => {
    const filters = parseFilters(req.query);
    const stats = await statisticsModel.getTimeSeries(filters, req.user);
    res.json(stats);
  },

  getSummary: async (req: AuthRequest, res: Response) => {
    const filters = parseFilters(req.query);
    const stats = await statisticsModel.getSummary(filters, req.user);
    res.json(stats);
  },

  getCustom: async (req: AuthRequest, res: Response) => {
    const filters = req.query as any;
    
    // Validate required params
    if (!filters.metric || !filters.dimension) {
      throw new ValidationError('Metric and dimension are required');
    }

    const stats = await statisticsModel.getCustomStats(filters, req.user);
    res.json(stats);
  },

  getBatch: async (req: AuthRequest, res: Response) => {
    const filters = applyUserScope(parseFilters(req.query), req.user);
    const [summary, timeSeries, kunde, varegruppe] = await Promise.all([
      statisticsModel.getSummary(filters, req.user),
      statisticsModel.getTimeSeries(filters, req.user),
      statisticsModel.getByKunde(filters),
      statisticsModel.getByVaregruppe(filters),
    ]);

    res.json({
      summary,
      timeSeries,
      kunde,
      varegruppe,
    });
  },
};

