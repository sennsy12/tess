import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { auditModel } from '../models/auditModel.js';

/**
 * Audit Controller
 * HTTP handlers for audit log endpoints (admin only)
 */
export const auditController = {
  /**
   * GET /api/audit
   * Get paginated audit log entries with optional filters
   */
  getAll: async (req: AuthRequest, res: Response) => {
    const {
      entity_type,
      action,
      user_id,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    const result = await auditModel.findAll({
      entity_type: entity_type as string | undefined,
      action: action as string | undefined,
      user_id: user_id ? parseInt(user_id as string) : undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({
      data: result.data,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 50)),
      },
    });
  },

  /**
   * GET /api/audit/:entityType/:entityId
   * Get audit history for a specific entity
   */
  getByEntity: async (req: AuthRequest, res: Response) => {
    const { entityType, entityId } = req.params;
    const entries = await auditModel.findByEntity(entityType, entityId);
    res.json(entries);
  },
};
