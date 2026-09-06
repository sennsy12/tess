import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { orderLineModel } from '../models/orderLineModel.js';
import { orderModel } from '../models/orderModel.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { parsePagination } from '../http/pagination.js';

// Overloads so TS narrows linjenrNum as defined when opts.linjenr is true
// (type-only change, no runtime change — unblocks ts-jest verification).
function parseOrdrenrLinjenr(
  params: { ordrenr?: unknown; linjenr?: unknown },
  opts: { linjenr: true },
): { ordrenrNum: number; linjenrNum: number };
function parseOrdrenrLinjenr(
  params: { ordrenr?: unknown; linjenr?: unknown },
  opts?: { linjenr?: false },
): { ordrenrNum: number };
function parseOrdrenrLinjenr(params: { ordrenr?: unknown; linjenr?: unknown }, opts?: { linjenr?: boolean }) {
  const ordrenrNum = Number(params.ordrenr);
  if (!Number.isInteger(ordrenrNum) || ordrenrNum < 1) {
    throw new ValidationError('Invalid order number');
  }
  if (opts?.linjenr) {
    const linjenrNum = Number(params.linjenr);
    if (!Number.isInteger(linjenrNum) || linjenrNum < 1) {
      throw new ValidationError('Invalid line number');
    }
    return { ordrenrNum, linjenrNum };
  }
  return { ordrenrNum };
}

export const orderLineController = {
  getByOrder: async (req: AuthRequest, res: Response) => {
    const { ordrenrNum } = parseOrdrenrLinjenr(req.params);
    const { page, limit } = parsePagination(
      req.query as unknown as Record<string, unknown>,
    );

    // Scope check: kunde users may only see their own orders.
    // Reuses the same ownership check as orderController.getOne;
    // foreign orders return 404 (not 403) to avoid order-number enumeration.
    const order = await orderModel.findByOrderNr(ordrenrNum, req.user);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const result = await orderLineModel.findByOrderNr(ordrenrNum, { page, limit });
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
    const { ordrenrNum, linjenrNum } = parseOrdrenrLinjenr(req.params, { linjenr: true });
    const { varekode, antall, enhet, nettpris, linjestatus } = req.body;

    const updatedLine = await orderLineModel.update(ordrenrNum, linjenrNum, {
      varekode, antall, enhet, nettpris, linjestatus
    });

    if (!updatedLine) {
      throw new NotFoundError('Order line not found');
    }

    res.json(updatedLine);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const { ordrenrNum, linjenrNum } = parseOrdrenrLinjenr(req.params, { linjenr: true });

    const deletedLine = await orderLineModel.delete(ordrenrNum, linjenrNum);

    if (!deletedLine) {
      throw new NotFoundError('Order line not found');
    }

    res.json({ message: 'Order line deleted', deleted: deletedLine });
  },

  updateReferences: async (req: AuthRequest, res: Response) => {
    const { ordrenrNum, linjenrNum } = parseOrdrenrLinjenr(req.params, { linjenr: true });
    const { henvisning1, henvisning2, henvisning3, henvisning4, henvisning5 } = req.body;

    const result = await orderLineModel.updateReferences(ordrenrNum, linjenrNum, {
      henvisning1, henvisning2, henvisning3, henvisning4, henvisning5
    });

    res.json(result);
  }
};

