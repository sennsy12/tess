import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { productModel } from '../models/productModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const productController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const { varegruppe } = req.query;
    const products = await productModel.findAll(varegruppe as string);
    res.json(products);
  },

  getGroups: async (req: AuthRequest, res: Response) => {
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
  }
};

