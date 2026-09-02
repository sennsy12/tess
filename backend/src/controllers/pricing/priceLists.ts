import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { priceListModel } from '../../models/pricingModel.js';
import { auditService } from '../../services/auditService.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';
import { CreatePriceListInput, UpdatePriceListInput } from '../../types/pricing.js';

/**
 * Pricing Controller - price list handlers
 */
export const priceListsHandlers = {
  // ============================================
  // PRICE LISTS
  // ============================================

  /**
   * GET /api/pricing/lists
   * Get all price lists
   */
  getLists: async (req: AuthRequest, res: Response) => {
    const activeOnly = req.query.active === 'true';
    const lists = activeOnly 
      ? await priceListModel.findActive()
      : await priceListModel.findAll();
    res.json(lists);
  },

  /**
   * GET /api/pricing/lists/:id
   * Get a single price list
   */
  getList: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const list = await priceListModel.findById(id);

    if (!list) {
      throw new NotFoundError('Price list not found');
    }

    res.json(list);
  },

  /**
   * POST /api/pricing/lists
   * Create a new price list
   */
  createList: async (req: AuthRequest, res: Response) => {
    const data: CreatePriceListInput = req.body;

    if (!data.name) {
      throw new ValidationError('Name is required');
    }

    const list = await priceListModel.create(data);

    await auditService.logFromRequest({
      req, action: 'CREATE', entityType: 'price_list',
      entityId: list.id, entityName: list.name,
    });

    res.status(201).json(list);
  },

  /**
   * PUT /api/pricing/lists/:id
   * Update a price list
   */
  updateList: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: UpdatePriceListInput = req.body;

    const oldList = await priceListModel.findById(id);
    if (!oldList) {
      throw new NotFoundError('Price list not found');
    }

    const list = await priceListModel.update(id, data);
    if (!list) {
      throw new NotFoundError('Price list not found');
    }

    await auditService.logFromRequest({
      req, action: 'UPDATE', entityType: 'price_list',
      entityId: id, entityName: list.name,
      oldData: oldList as any, newData: list as any,
    });

    res.json(list);
  },

  /**
   * DELETE /api/pricing/lists/:id
   * Delete a price list
   */
  deleteList: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const oldList = await priceListModel.findById(id);
    const deleted = await priceListModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Price list not found');
    }

    await auditService.logFromRequest({
      req, action: 'DELETE', entityType: 'price_list',
      entityId: id, entityName: oldList?.name, oldData: oldList as any,
    });

    res.json({ message: 'Price list deleted successfully' });
  },
};
