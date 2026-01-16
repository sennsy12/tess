import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerModel } from '../models/customerModel.js';

export const customerController = {
  getAll: async (req: AuthRequest, res: Response) => {
    try {
      const customers = await customerModel.findAll();
      res.json(customers);
    } catch (error) {
      console.error('Get customers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getOne: async (req: AuthRequest, res: Response) => {
    try {
      const { kundenr } = req.params;
      const customer = await customerModel.findByNumber(kundenr);
      
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      res.json(customer);
    } catch (error) {
      console.error('Get customer error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
