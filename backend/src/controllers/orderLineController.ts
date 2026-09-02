import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { orderLineModel } from '../models/orderLineModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { parsePagination } from '../http/pagination.js';

export const orderLineController = {
  getByOrder: async (req: AuthRequest, res: Response) => {
    const { ordrenr } = req.params;
    const { page, limit } = parsePagination(
      req.query as unknown as Record<string, unknown>,
    );

    const result = await orderLineModel.findByOrderNr(Number(ordrenr), { page, limit });
    res.json(result);
  },

  // NOTE: create/update/delete already recalc ordre.sum inside the same
  // transaction (see orderLineModel) — no second updateOrderSum call needed.
  create: async (req: AuthRequest, res: Response) => {
    const { ordrenr, varekode, antall, enhet, nettpris, linjestatus } = req.body;

    const newLine = await orderLineModel.create({
      ordrenr, varekode, antall, enhet, nettpris, linjestatus
    });

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

    res.json(updatedLine);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const { ordrenr, linjenr } = req.params;

    const deletedLine = await orderLineModel.delete(Number(ordrenr), Number(linjenr));

    if (!deletedLine) {
      throw new NotFoundError('Order line not found');
    }

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

