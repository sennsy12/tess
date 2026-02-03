import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { orderLineModel } from '../models/orderLineModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const orderLineController = {
  getByOrder: async (req: AuthRequest, res: Response) => {
    const { ordrenr } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await orderLineModel.findByOrderNr(Number(ordrenr), { page, limit });
    res.json(result);
  },

  create: async (req: AuthRequest, res: Response) => {
    const { ordrenr, varekode, antall, enhet, nettpris, linjestatus } = req.body;
    
    const newLine = await orderLineModel.create({
      ordrenr, varekode, antall, enhet, nettpris, linjestatus
    });

    await orderLineModel.updateOrderSum(ordrenr);

    res.status(201).json(newLine);
  },

  update: async (req: AuthRequest, res: Response) => {
    const { ordrenr, linjenr } = req.params;
    const { varekode, antall, enhet, nettpris, linjestatus } = req.body;

    const updatedLine = await orderLineModel.update(Number(ordrenr), Number(linjenr), {
      varekode, antall, enhet, nettpris, linjestatus
    });

    if (!updatedLine) {
      throw new NotFoundError('Order line not found');
    }

    await orderLineModel.updateOrderSum(Number(ordrenr));

    res.json(updatedLine);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const { ordrenr, linjenr } = req.params;

    const deletedLine = await orderLineModel.delete(Number(ordrenr), Number(linjenr));

    if (!deletedLine) {
      throw new NotFoundError('Order line not found');
    }

    await orderLineModel.updateOrderSum(Number(ordrenr));

    res.json({ message: 'Order line deleted', deleted: deletedLine });
  },

  updateReferences: async (req: AuthRequest, res: Response) => {
    const { ordrenr, linjenr } = req.params;
    const { henvisning1, henvisning2, henvisning3, henvisning4, henvisning5 } = req.body;

    const result = await orderLineModel.updateReferences(Number(ordrenr), Number(linjenr), {
      henvisning1, henvisning2, henvisning3, henvisning4, henvisning5
    });

    res.json(result);
  }
};

