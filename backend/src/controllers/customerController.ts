import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerModel } from '../models/customerModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const customerController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const customers = await customerModel.findAll();
    res.json(customers);
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

