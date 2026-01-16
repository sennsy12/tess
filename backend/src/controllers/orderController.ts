import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { orderModel, OrderFilters } from '../models/orderModel.js';

export const orderController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const filters: OrderFilters = req.query as any;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const result = await orderModel.findAll(filters, req.user, { limit, offset });
      
      // If result is an array (legacy support or no pagination), wrap it
      if (Array.isArray(result)) {
        res.json({
          data: result,
          total: result.length,
          page: 1,
          limit: result.length,
          totalPages: 1
        });
      } else {
        res.json({
          data: result.data,
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit)
        });
      }
    } catch (error) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr } = req.params;
      const order = await orderModel.findByOrderNr(Number(ordrenr), req.user);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const lines = await orderModel.findLines(Number(ordrenr));

      res.json({
        ...order,
        lines,
      });
    } catch (error) {
      console.error('Get order error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  searchReferences: async (req: AuthRequest, res: Response) => {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const orders = await orderModel.searchReferences(q as string, req.user);
      res.json(orders);
    } catch (error) {
      console.error('Search references error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
