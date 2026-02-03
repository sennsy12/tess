import { Response } from 'express';
import { reportModel } from '../models/reportModel.js';
import { AuthRequest } from '../middleware/auth.js';
import { ValidationError, NotFoundError, UnauthorizedError } from '../middleware/errorHandler.js';

export const reportController = {
  saveReport: async (req: AuthRequest, res: Response) => {
    const { name, config } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    if (!name || !config) {
      throw new ValidationError('Name and config are required');
    }

    const report = await reportModel.create(userId, name, config);
    res.json({ success: true, data: report });
  },

  getReports: async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const reports = await reportModel.getByUser(userId);
    res.json({ success: true, data: reports });
  },

  deleteReport: async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const reportId = parseInt(req.params.id);

    if (!userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    const success = await reportModel.delete(reportId, userId);
    if (!success) {
      throw new NotFoundError('Report not found');
    }

    res.json({ success: true, message: 'Report deleted' });
  },
};

