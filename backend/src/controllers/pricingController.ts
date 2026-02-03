import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerGroupModel, priceListModel, priceRuleModel } from '../models/pricingModel.js';
import { pricingService } from '../services/pricingService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import {
  CreateCustomerGroupInput,
  CreatePriceListInput,
  UpdatePriceListInput,
  CreatePriceRuleInput,
  UpdatePriceRuleInput,
  PriceCalculationInput
} from '../types/pricing.js';

/**
 * Pricing Controller
 * HTTP handlers for pricing system endpoints
 */
export const pricingController = {
  // ============================================
  // CUSTOMER GROUPS
  // ============================================

  /**
   * GET /api/pricing/groups
   * Get all customer groups
   */
  getGroups: async (req: AuthRequest, res: Response) => {
    const groups = await customerGroupModel.findAll();
    res.json(groups);
  },

  /**
   * POST /api/pricing/groups
   * Create a new customer group
   */
  createGroup: async (req: AuthRequest, res: Response) => {
    const data: CreateCustomerGroupInput = req.body;

    if (!data.name) {
      throw new ValidationError('Name is required');
    }

    const group = await customerGroupModel.create(data);
    res.status(201).json(group);
  },

  /**
   * PUT /api/pricing/groups/:id
   * Update a customer group
   */
  updateGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: Partial<CreateCustomerGroupInput> = req.body;

    const group = await customerGroupModel.update(id, data);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    res.json(group);
  },

  /**
   * DELETE /api/pricing/groups/:id
   * Delete a customer group
   */
  deleteGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await customerGroupModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Group not found');
    }

    res.json({ message: 'Group deleted successfully' });
  },

  /**
   * PUT /api/pricing/groups/:id/customers/:kundenr
   * Assign a customer to a group
   */
  assignCustomerToGroup: async (req: AuthRequest, res: Response) => {
    const groupId = parseInt(req.params.id);
    const { kundenr } = req.params;

    // Verify group exists
    const group = await customerGroupModel.findById(groupId);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const updated = await customerGroupModel.assignCustomer(kundenr, groupId);
    if (!updated) {
      throw new NotFoundError('Customer not found');
    }

    res.json({ message: 'Customer assigned to group successfully' });
  },

  /**
   * DELETE /api/pricing/groups/customers/:kundenr
   * Remove a customer from their group (set to null)
   */
  removeCustomerFromGroup: async (req: AuthRequest, res: Response) => {
    const { kundenr } = req.params;
    const updated = await customerGroupModel.assignCustomer(kundenr, null);

    if (!updated) {
      throw new NotFoundError('Customer not found');
    }

    res.json({ message: 'Customer removed from group successfully' });
  },

  /**
   * GET /api/pricing/customers
   * Get all customers with their group info
   */
  getCustomersWithGroups: async (req: AuthRequest, res: Response) => {
    const customers = await customerGroupModel.getCustomersWithGroups();
    res.json(customers);
  },

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
    res.status(201).json(list);
  },

  /**
   * PUT /api/pricing/lists/:id
   * Update a price list
   */
  updateList: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: UpdatePriceListInput = req.body;

    const list = await priceListModel.update(id, data);
    if (!list) {
      throw new NotFoundError('Price list not found');
    }

    res.json(list);
  },

  /**
   * DELETE /api/pricing/lists/:id
   * Delete a price list
   */
  deleteList: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await priceListModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Price list not found');
    }

    res.json({ message: 'Price list deleted successfully' });
  },

  // ============================================
  // PRICE RULES
  // ============================================

  /**
   * GET /api/pricing/lists/:id/rules
   * Get all rules for a price list
   */
  getRules: async (req: AuthRequest, res: Response) => {
    const listId = parseInt(req.params.id);
    const rules = await priceRuleModel.findByListId(listId);
    res.json(rules);
  },

  /**
   * GET /api/pricing/rules/:id
   * Get a single rule
   */
  getRule: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const rule = await priceRuleModel.findById(id);

    if (!rule) {
      throw new NotFoundError('Price rule not found');
    }

    res.json(rule);
  },

  /**
   * POST /api/pricing/rules
   * Create a new price rule
   */
  createRule: async (req: AuthRequest, res: Response) => {
    const data: CreatePriceRuleInput = req.body;

    if (!data.price_list_id) {
      throw new ValidationError('price_list_id is required');
    }

    if (data.discount_percent === undefined && data.fixed_price === undefined) {
      throw new ValidationError('Either discount_percent or fixed_price is required');
    }

    if (data.discount_percent !== undefined && data.fixed_price !== undefined) {
      throw new ValidationError('Cannot set both discount_percent and fixed_price');
    }

    const rule = await priceRuleModel.create(data);
    res.status(201).json(rule);
  },

  /**
   * PUT /api/pricing/rules/:id
   * Update a price rule
   */
  updateRule: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: UpdatePriceRuleInput = req.body;

    const rule = await priceRuleModel.update(id, data);
    if (!rule) {
      throw new NotFoundError('Price rule not found');
    }

    res.json(rule);
  },

  /**
   * DELETE /api/pricing/rules/:id
   * Delete a price rule
   */
  deleteRule: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const deleted = await priceRuleModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Price rule not found');
    }

    res.json({ message: 'Price rule deleted successfully' });
  },

  // ============================================
  // PRICE CALCULATION
  // ============================================

  /**
   * POST /api/pricing/calculate
   * Calculate price for a product
   */
  calculatePrice: async (req: AuthRequest, res: Response) => {
    const data: PriceCalculationInput = req.body;

    if (!data.varekode || !data.kundenr || data.quantity === undefined || data.base_price === undefined) {
      throw new ValidationError('varekode, kundenr, quantity, and base_price are required');
    }

    const result = await pricingService.calculatePrice(data);
    res.json(result);
  },

  /**
   * POST /api/pricing/calculate/bulk
   * Calculate prices for multiple products
   */
  calculatePricesBulk: async (req: AuthRequest, res: Response) => {
    const { items, kundenr } = req.body;

    if (!items || !Array.isArray(items) || !kundenr) {
      throw new ValidationError('items array and kundenr are required');
    }

    const results = await pricingService.calculatePricesForOrder(items, kundenr);
    res.json(results);
  },

  /**
   * GET /api/pricing/customer/:kundenr/rules
   * Get all applicable rules for a customer
   */
  getCustomerRules: async (req: AuthRequest, res: Response) => {
    const { kundenr } = req.params;
    const rules = await pricingService.getApplicableRulesForCustomer(kundenr);
    res.json(rules);
  }
};

