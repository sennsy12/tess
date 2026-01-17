import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerGroupModel, priceListModel, priceRuleModel } from '../models/pricingModel.js';
import { pricingService } from '../services/pricingService.js';
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
    try {
      const groups = await customerGroupModel.findAll();
      res.json(groups);
    } catch (error) {
      console.error('Get customer groups error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/pricing/groups
   * Create a new customer group
   */
  createGroup: async (req: AuthRequest, res: Response) => {
    try {
      const data: CreateCustomerGroupInput = req.body;

      if (!data.name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const group = await customerGroupModel.create(data);
      res.status(201).json(group);
    } catch (error: any) {
      console.error('Create customer group error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Group with this name already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PUT /api/pricing/groups/:id
   * Update a customer group
   */
  updateGroup: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data: Partial<CreateCustomerGroupInput> = req.body;

      const group = await customerGroupModel.update(id, data);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json(group);
    } catch (error: any) {
      console.error('Update customer group error:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Group with this name already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * DELETE /api/pricing/groups/:id
   * Delete a customer group
   */
  deleteGroup: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await customerGroupModel.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      console.error('Delete customer group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PUT /api/pricing/groups/:id/customers/:kundenr
   * Assign a customer to a group
   */
  assignCustomerToGroup: async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id);
      const { kundenr } = req.params;

      // Verify group exists
      const group = await customerGroupModel.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const updated = await customerGroupModel.assignCustomer(kundenr, groupId);
      if (!updated) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json({ message: 'Customer assigned to group successfully' });
    } catch (error) {
      console.error('Assign customer to group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * DELETE /api/pricing/groups/customers/:kundenr
   * Remove a customer from their group (set to null)
   */
  removeCustomerFromGroup: async (req: AuthRequest, res: Response) => {
    try {
      const { kundenr } = req.params;
      const updated = await customerGroupModel.assignCustomer(kundenr, null);

      if (!updated) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      res.json({ message: 'Customer removed from group successfully' });
    } catch (error) {
      console.error('Remove customer from group error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/pricing/customers
   * Get all customers with their group info
   */
  getCustomersWithGroups: async (req: AuthRequest, res: Response) => {
    try {
      const customers = await customerGroupModel.getCustomersWithGroups();
      res.json(customers);
    } catch (error) {
      console.error('Get customers with groups error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // PRICE LISTS
  // ============================================

  /**
   * GET /api/pricing/lists
   * Get all price lists
   */
  getLists: async (req: AuthRequest, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const lists = activeOnly 
        ? await priceListModel.findActive()
        : await priceListModel.findAll();
      res.json(lists);
    } catch (error) {
      console.error('Get price lists error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/pricing/lists/:id
   * Get a single price list
   */
  getList: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const list = await priceListModel.findById(id);

      if (!list) {
        return res.status(404).json({ error: 'Price list not found' });
      }

      res.json(list);
    } catch (error) {
      console.error('Get price list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/pricing/lists
   * Create a new price list
   */
  createList: async (req: AuthRequest, res: Response) => {
    try {
      const data: CreatePriceListInput = req.body;

      if (!data.name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const list = await priceListModel.create(data);
      res.status(201).json(list);
    } catch (error) {
      console.error('Create price list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PUT /api/pricing/lists/:id
   * Update a price list
   */
  updateList: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data: UpdatePriceListInput = req.body;

      const list = await priceListModel.update(id, data);
      if (!list) {
        return res.status(404).json({ error: 'Price list not found' });
      }

      res.json(list);
    } catch (error) {
      console.error('Update price list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * DELETE /api/pricing/lists/:id
   * Delete a price list
   */
  deleteList: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await priceListModel.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Price list not found' });
      }

      res.json({ message: 'Price list deleted successfully' });
    } catch (error) {
      console.error('Delete price list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // PRICE RULES
  // ============================================

  /**
   * GET /api/pricing/lists/:id/rules
   * Get all rules for a price list
   */
  getRules: async (req: AuthRequest, res: Response) => {
    try {
      const listId = parseInt(req.params.id);
      const rules = await priceRuleModel.findByListId(listId);
      res.json(rules);
    } catch (error) {
      console.error('Get price rules error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/pricing/rules/:id
   * Get a single rule
   */
  getRule: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await priceRuleModel.findById(id);

      if (!rule) {
        return res.status(404).json({ error: 'Price rule not found' });
      }

      res.json(rule);
    } catch (error) {
      console.error('Get price rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/pricing/rules
   * Create a new price rule
   */
  createRule: async (req: AuthRequest, res: Response) => {
    try {
      const data: CreatePriceRuleInput = req.body;

      if (!data.price_list_id) {
        return res.status(400).json({ error: 'price_list_id is required' });
      }

      if (data.discount_percent === undefined && data.fixed_price === undefined) {
        return res.status(400).json({ error: 'Either discount_percent or fixed_price is required' });
      }

      if (data.discount_percent !== undefined && data.fixed_price !== undefined) {
        return res.status(400).json({ error: 'Cannot set both discount_percent and fixed_price' });
      }

      const rule = await priceRuleModel.create(data);
      res.status(201).json(rule);
    } catch (error: any) {
      console.error('Create price rule error:', error);
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Invalid price_list_id or customer_group_id' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PUT /api/pricing/rules/:id
   * Update a price rule
   */
  updateRule: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data: UpdatePriceRuleInput = req.body;

      const rule = await priceRuleModel.update(id, data);
      if (!rule) {
        return res.status(404).json({ error: 'Price rule not found' });
      }

      res.json(rule);
    } catch (error) {
      console.error('Update price rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * DELETE /api/pricing/rules/:id
   * Delete a price rule
   */
  deleteRule: async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await priceRuleModel.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Price rule not found' });
      }

      res.json({ message: 'Price rule deleted successfully' });
    } catch (error) {
      console.error('Delete price rule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // ============================================
  // PRICE CALCULATION
  // ============================================

  /**
   * POST /api/pricing/calculate
   * Calculate price for a product
   */
  calculatePrice: async (req: AuthRequest, res: Response) => {
    try {
      const data: PriceCalculationInput = req.body;

      if (!data.varekode || !data.kundenr || data.quantity === undefined || data.base_price === undefined) {
        return res.status(400).json({ 
          error: 'varekode, kundenr, quantity, and base_price are required' 
        });
      }

      const result = await pricingService.calculatePrice(data);
      res.json(result);
    } catch (error) {
      console.error('Calculate price error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/pricing/calculate/bulk
   * Calculate prices for multiple products
   */
  calculatePricesBulk: async (req: AuthRequest, res: Response) => {
    try {
      const { items, kundenr } = req.body;

      if (!items || !Array.isArray(items) || !kundenr) {
        return res.status(400).json({ error: 'items array and kundenr are required' });
      }

      const results = await pricingService.calculatePricesForOrder(items, kundenr);
      res.json(results);
    } catch (error) {
      console.error('Calculate bulk prices error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/pricing/customer/:kundenr/rules
   * Get all applicable rules for a customer
   */
  getCustomerRules: async (req: AuthRequest, res: Response) => {
    try {
      const { kundenr } = req.params;
      const rules = await pricingService.getApplicableRulesForCustomer(kundenr);
      res.json(rules);
    } catch (error) {
      console.error('Get customer rules error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
