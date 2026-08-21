import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { productModel } from '../models/productModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { buildListResponse } from '../lib/listResponse.js';
import {
  productListQuerySchema,
  updateProductPriceSchema,
} from '../middleware/validation.js';
import { auditService } from '../services/auditService.js';

export const productController = {
  /** Paginated product list (GET / and GET /search). */
  list: async (req: AuthRequest, res: Response) => {
    const { page, limit, sortBy, sortDir, search, varegruppe } = req.query as unknown as z.infer<
      typeof productListQuerySchema
    >;

    const result = await productModel.searchProducts({
      search,
      varegruppe,
      page,
      limit,
      sortBy,
      sortDir,
    });

    res.json(buildListResponse(result.data, { page, limit, total: result.total }));
  },

  getGroups: async (_req: AuthRequest, res: Response) => {
    const groups = await productModel.findGroups();
    res.json(groups);
  },

  getOne: async (req: AuthRequest, res: Response) => {
    const { varekode } = req.params;
    const product = await productModel.findByCode(varekode);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    res.json(product);
  },

  /** Set the catalog base price for a product (admin action). */
  updateBasePrice: async (req: AuthRequest, res: Response) => {
    const { varekode } = req.params;
    const { base_price } = req.body as z.infer<typeof updateProductPriceSchema>;

    const existing = await productModel.findByCode(varekode);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const updated = await productModel.updateBasePrice(varekode, base_price);

    await auditService.log({
      user: {
        id: req.user?.id,
        username: req.user?.username || 'unknown',
      },
      action: 'UPDATE',
      entityType: 'vare',
      entityId: varekode,
      entityName: existing.varenavn ?? varekode,
      oldData: { base_price: existing.base_price },
      newData: { base_price: updated?.base_price ?? base_price },
      ipAddress: req.ip,
    });

    res.json(updated);
  },
};
