import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statusModel } from '../models/statusModel.js';

export const statusController = {
  getSystemStatus: async (req: AuthRequest, res: Response) => {
    try {
      const status = await statusModel.getSystemStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: { connected: false, error: 'Database connection failed' },
      });
    }
  },

  getImportStatus: async (req: AuthRequest, res: Response) => {
    const status = await statusModel.getImportStatus();
    res.json(status);
  },

  getExtractionStatus: async (req: AuthRequest, res: Response) => {
    const status = await statusModel.getExtractionStatus();
    res.json(status);
  },

  getHealth: async (req: AuthRequest, res: Response) => {
    const health = await statusModel.getHealth();
    res.json(health);
  }
};

