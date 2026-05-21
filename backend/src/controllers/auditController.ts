import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { auditModel } from '../models/auditModel.js';
import { buildListResponse } from '../lib/listResponse.js';
import { auditQuerySchema } from '../middleware/validation.js';

/**
 * Audit Controller
 * HTTP handlers for audit log endpoints (admin only)
 */
export const auditController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const { page, limit, entity_type, action, user_id, startDate, endDate } =
      req.query as unknown as z.infer<typeof auditQuerySchema>;

    const result = await auditModel.findAll({
      entity_type,
      action,
      user_id,
      startDate,
      endDate,
      page,
      limit,
    });

    res.json(buildListResponse(result.data, { page, limit, total: result.total }));
  },

  getByEntity: async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.params;
    const history = await auditModel.findByEntity(entityType, entityId);
    res.json(history);
  },
};
