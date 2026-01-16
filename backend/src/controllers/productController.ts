import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { productModel } from '../models/productModel.js';

export const productController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const { varegruppe } = req.query;
      const products = await productModel.findAll(varegruppe as string);
      res.json(products);
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getGroups: async (req: AuthRequest, res: Response) => {
    try {
      const groups = await productModel.findGroups();
      res.json(groups);
    } catch (error) {
      console.error('Get product groups error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const { varekode } = req.params;
      const product = await productModel.findByCode(varekode);
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
