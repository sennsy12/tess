import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { productModel } from '../models/productModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { buildListResponse } from '../lib/listResponse.js';
import { productListQuerySchema } from '../middleware/validation.js';

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
};
