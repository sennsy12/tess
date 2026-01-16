import { Request, Response } from 'express';
import { reportModel } from '../models/reportModel.js';
import { AuthRequest } from '../middleware/auth.js';

export const reportController = {
  saveReport: async (req: AuthRequest, res: Response) => {
    try {
      const { name, config } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!name || !config) {
        return res.status(400).json({ error: 'Name and config are required' });
      }

      const report = await reportModel.create(userId, name, config);
      res.json({ success: true, data: report });
    } catch (error: any) {
      console.error('Save report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getReports: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const reports = await reportModel.getByUser(userId);
      res.json({ success: true, data: reports });
    } catch (error: any) {
      console.error('Get reports error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  deleteReport: async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const reportId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const success = await reportModel.delete(reportId, userId);
      if (success) {
        res.json({ success: true, message: 'Report deleted' });
      } else {
        res.status(404).json({ success: false, error: 'Report not found' });
      }
    } catch (error: any) {
      console.error('Delete report error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },
};
