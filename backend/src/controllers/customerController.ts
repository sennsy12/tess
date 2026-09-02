import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerModel } from '../models/customerModel.js';
import { customerProfileService } from '../services/customerProfileService.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { parsePagination } from '../http/pagination.js';
import { buildListResponse } from '../lib/listResponse.js';

export const customerController = {
  /**
   * List customers. Without `?page` returns the historic bare array
   * (admin dropdowns); with `?page` returns the standard paginated
   * envelope. New callers should use `?page`.
   */
  getAll: async (req: AuthRequest, res: Response) => {
    if (req.query.page === undefined) {
      const customers = await customerModel.findAll();
      return res.json(customers);
    }
    const { page, limit } = parsePagination(
      req.query as unknown as Record<string, unknown>,
    );
    const result = await customerModel.findAllPaginated({ page, limit });
    res.json(buildListResponse(result.data, { page, limit, total: result.total }));
  },

  getMyProfile: async (req: AuthRequest, res: Response) => {
    const profile = await customerProfileService.getForAuthenticatedUser(req.user);
    res.json(profile);
  },

  getOne: async (req: AuthRequest, res: Response) => {
    const { kundenr } = req.params;
    const customer = await customerModel.findByNumber(kundenr);
    
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    
    res.json(customer);
  }
};

