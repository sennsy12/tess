import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { orderLineModel } from '../models/orderLineModel.js';

export const orderLineController = {
  getByOrder: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr } = req.params;
      const lines = await orderLineModel.findByOrderNr(Number(ordrenr));
      res.json(lines);
    } catch (error) {
      console.error('Get order lines error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr, varekode, antall, enhet, nettpris, linjestatus } = req.body;
      
      const newLine = await orderLineModel.create({
        ordrenr, varekode, antall, enhet, nettpris, linjestatus
      });

      await orderLineModel.updateOrderSum(ordrenr);

      res.status(201).json(newLine);
    } catch (error) {
      console.error('Create order line error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  update: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr, linjenr } = req.params;
      const { varekode, antall, enhet, nettpris, linjestatus } = req.body;

      const updatedLine = await orderLineModel.update(Number(ordrenr), Number(linjenr), {
        varekode, antall, enhet, nettpris, linjestatus
      });

      if (!updatedLine) {
        return res.status(404).json({ error: 'Order line not found' });
      }

      await orderLineModel.updateOrderSum(Number(ordrenr));

      res.json(updatedLine);
    } catch (error) {
      console.error('Update order line error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  delete: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr, linjenr } = req.params;

      const deletedLine = await orderLineModel.delete(Number(ordrenr), Number(linjenr));

      if (!deletedLine) {
        return res.status(404).json({ error: 'Order line not found' });
      }

      await orderLineModel.updateOrderSum(Number(ordrenr));

      res.json({ message: 'Order line deleted', deleted: deletedLine });
    } catch (error) {
      console.error('Delete order line error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateReferences: async (req: AuthRequest, res: Response) => {
    try {
      const { ordrenr, linjenr } = req.params;
      const { henvisning1, henvisning2, henvisning3, henvisning4, henvisning5 } = req.body;

      const result = await orderLineModel.updateReferences(Number(ordrenr), Number(linjenr), {
        henvisning1, henvisning2, henvisning3, henvisning4, henvisning5
      });

      res.json(result);
    } catch (error) {
      console.error('Update references error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
