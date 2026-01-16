import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statisticsModel, StatsFilters } from '../models/statisticsModel.js';

export const statisticsController = {
  getByKunde: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getByKunde(filters);
      res.json(stats);
    } catch (error) {
      console.error('Statistics by kunde error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getByVaregruppe: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getByVaregruppe(filters);
      res.json(stats);
    } catch (error) {
      console.error('Statistics by varegruppe error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getByVare: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getByVare(filters);
      res.json(stats);
    } catch (error) {
      console.error('Statistics by vare error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getByLager: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getByLager(filters);
      res.json(stats);
    } catch (error) {
      console.error('Statistics by lager error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getByFirma: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getByFirma(filters);
      res.json(stats);
    } catch (error) {
      console.error('Statistics by firma error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getTimeSeries: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getTimeSeries(filters);
      res.json(stats);
    } catch (error) {
      console.error('Time series statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getSummary: async (req: AuthRequest, res: Response) => {
    try {
      const filters: StatsFilters = req.query as any;
      const stats = await statisticsModel.getSummary(filters);
      res.json(stats);
    } catch (error) {
      console.error('Summary statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getCustom: async (req: AuthRequest, res: Response) => {
    try {
      const filters = req.query as any;
      
      // Validate required params
      if (!filters.metric || !filters.dimension) {
        return res.status(400).json({ error: 'Metric and dimension are required' });
      }

      const stats = await statisticsModel.getCustomStats(filters, req.user);
      res.json(stats);
    } catch (error) {
      console.error('Custom statistics error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
