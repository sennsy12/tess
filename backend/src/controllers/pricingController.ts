import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { customerGroupModel, priceListModel, priceRuleModel } from '../models/pricingModel.js';
import { pricingService } from '../services/pricingService.js';
import { detectConflicts } from '../services/conflictDetectionService.js';
import { auditService } from '../services/auditService.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import {
  CreateCustomerGroupInput,
  CreatePriceListInput,
  UpdatePriceListInput,
  CreatePriceRuleInput,
  UpdatePriceRuleInput,
  PriceCalculationInput
} from '../types/pricing.js';

/** Helper to extract audit user from request */
function getAuditUser(req: AuthRequest) {
  return { id: req.user?.id, username: req.user?.username || 'unknown' };
}

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

    await auditService.log({
      user: getAuditUser(req), action: 'CREATE', entityType: 'customer_group',
      entityId: group.id, entityName: group.name, ipAddress: req.ip,
    });

    res.status(201).json(group);
  },

  /**
   * PUT /api/pricing/groups/:id
   * Update a customer group
   */
  updateGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: Partial<CreateCustomerGroupInput> = req.body;

    const oldGroup = await customerGroupModel.findById(id);
    if (!oldGroup) {
      throw new NotFoundError('Group not found');
    }

    const group = await customerGroupModel.update(id, data);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'UPDATE', entityType: 'customer_group',
      entityId: id, entityName: group.name,
      oldData: oldGroup as any, newData: group as any, ipAddress: req.ip,
    });

    res.json(group);
  },

  /**
   * DELETE /api/pricing/groups/:id
   * Delete a customer group
   */
  deleteGroup: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const oldGroup = await customerGroupModel.findById(id);
    const deleted = await customerGroupModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Group not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'DELETE', entityType: 'customer_group',
      entityId: id, entityName: oldGroup?.name, oldData: oldGroup as any, ipAddress: req.ip,
    });

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
   * Get all customers with their group info (lightweight, for dropdowns)
   */
  getCustomersWithGroups: async (req: AuthRequest, res: Response) => {
    const customers = await customerGroupModel.getCustomersWithGroups();
    res.json(customers);
  },

  /**
   * GET /api/pricing/customers/search
   * Search customers with server-side pagination, search, and group filtering
   * Query params: search, group, page, limit
   */
  searchCustomers: async (req: AuthRequest, res: Response) => {
    const search = (req.query.search as string) || '';
    const groupId = (req.query.group as string) || undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));

    const result = await customerGroupModel.searchCustomersWithGroups({
      search,
      groupId,
      page,
      limit,
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
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

    await auditService.log({
      user: getAuditUser(req), action: 'CREATE', entityType: 'price_list',
      entityId: list.id, entityName: list.name, ipAddress: req.ip,
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

    await auditService.log({
      user: getAuditUser(req), action: 'UPDATE', entityType: 'price_list',
      entityId: id, entityName: list.name,
      oldData: oldList as any, newData: list as any, ipAddress: req.ip,
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

    await auditService.log({
      user: getAuditUser(req), action: 'DELETE', entityType: 'price_list',
      entityId: id, entityName: oldList?.name, oldData: oldList as any, ipAddress: req.ip,
    });

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

    await auditService.log({
      user: getAuditUser(req), action: 'CREATE', entityType: 'price_rule',
      entityId: rule.id, entityName: `Regel #${rule.id} (liste ${rule.price_list_id})`, ipAddress: req.ip,
    });

    res.status(201).json(rule);
  },

  /**
   * PUT /api/pricing/rules/:id
   * Update a price rule
   */
  updateRule: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);
    const data: UpdatePriceRuleInput = req.body;

    if (data.discount_percent !== undefined && data.fixed_price !== undefined
        && data.discount_percent !== null && data.fixed_price !== null) {
      throw new ValidationError('Cannot set both discount_percent and fixed_price');
    }

    const existing = await priceRuleModel.findById(id);
    if (!existing) {
      throw new NotFoundError('Price rule not found');
    }

    const rule = await priceRuleModel.update(id, data);
    if (!rule) {
      throw new NotFoundError('Price rule not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'UPDATE', entityType: 'price_rule',
      entityId: id, entityName: `Regel #${id} (liste ${existing.price_list_id})`,
      oldData: existing as any, newData: rule as any, ipAddress: req.ip,
    });

    res.json(rule);
  },

  /**
   * DELETE /api/pricing/rules/:id
   * Delete a price rule
   */
  deleteRule: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id);

    const oldRule = await priceRuleModel.findById(id);
    const deleted = await priceRuleModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Price rule not found');
    }

    await auditService.log({
      user: getAuditUser(req), action: 'DELETE', entityType: 'price_rule',
      entityId: id, entityName: `Regel #${id}`, oldData: oldRule as any, ipAddress: req.ip,
    });

    res.json({ message: 'Price rule deleted successfully' });
  },

  // ============================================
  // CONFLICT DETECTION
  // ============================================

  /**
   * POST /api/pricing/rules/check-conflicts
   * Check for conflicting rules before saving
   */
  checkRuleConflicts: async (req: AuthRequest, res: Response) => {
    const { price_list_id, varekode, varegruppe, kundenr, customer_group_id, min_quantity, exclude_rule_id } = req.body;

    if (!price_list_id) {
      throw new ValidationError('price_list_id is required');
    }

    const conflicts = await detectConflicts(
      { price_list_id, varekode, varegruppe, kundenr, customer_group_id, min_quantity },
      exclude_rule_id ? parseInt(exclude_rule_id) : undefined
    );

    res.json(conflicts);
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

