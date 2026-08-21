import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { catalogService } from '../services/catalogService.js';
import { ForbiddenError } from '../middleware/errorHandler.js';
import { catalogQuerySchema } from '../middleware/validation.js';

export const catalogController = {
  /**
   * Customer product catalog with per-customer effective prices.
   * Kundenr is derived from the JWT for kunde users; admins may pass
   * ?kundenr= to browse as a specific customer (plain base prices otherwise).
   */
  list: async (req: AuthRequest, res: Response) => {
    const q = req.query as unknown as z.infer<typeof catalogQuerySchema>;
    const user = req.user!;

    let kundenr: string | undefined;
    if (user.role === 'kunde') {
      if (!user.kundenr) {
        throw new ForbiddenError('Brukeren mangler kundenummer');
      }
      if (q.kundenr && q.kundenr !== user.kundenr) {
        throw new ForbiddenError('Access denied');
      }
      kundenr = user.kundenr;
    } else {
      kundenr = q.kundenr;
    }

    const result = await catalogService.listForCustomer({
      search: q.search,
      varegruppe: q.varegruppe,
      page: q.page,
      limit: q.limit,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      kundenr: kundenr ?? '',
    });

    res.json({
      data: result.data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / q.limit),
      },
      pricedFor: kundenr ?? null,
    });
  },
};
