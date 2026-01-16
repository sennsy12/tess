import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { statusModel } from '../models/statusModel.js';

export const statusController = {
  getSystemStatus: async (req: AuthRequest, res: Response) => {
    try {
      const status = await statusModel.getSystemStatus();
      res.json(status);
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          error: 'Database connection failed',
        },
      });
    }
  },

  getImportStatus: async (req: AuthRequest, res: Response) => {
    try {
      const status = await statusModel.getImportStatus();
      res.json(status);
    } catch (error) {
      console.error('Import status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to check import status',
      });
    }
  },

  getExtractionStatus: async (req: AuthRequest, res: Response) => {
    try {
      const status = await statusModel.getExtractionStatus();
      res.json(status);
    } catch (error) {
      console.error('Extraction status error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to check extraction status',
      });
    }
  },

  getHealth: async (req: AuthRequest, res: Response) => {
    try {
      const health = await statusModel.getHealth();
      res.json(health);
    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        status: 'unhealthy',
        message: 'Health check failed',
      });
    }
  }
};
