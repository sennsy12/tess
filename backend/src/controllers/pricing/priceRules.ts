import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { priceRuleModel } from '../../models/pricingModel.js';
import { detectConflicts } from '../../services/conflictDetectionService.js';
import { auditService } from '../../services/auditService.js';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler.js';
import { CreatePriceRuleInput, UpdatePriceRuleInput } from '../../types/pricing.js';

/**
 * Pricing Controller - price rule handlers
 */
export const priceRulesHandlers = {
  // ============================================
  // PRICE RULES
  // ============================================

  /**
   * GET /api/pricing/lists/:id/rules
   * Get all rules for a price list
   */
  getRules: async (req: AuthRequest, res: Response) => {
    const listId = Number(req.params.id);
    if (!Number.isInteger(listId) || listId < 1) {
      throw new ValidationError('Invalid ID');
    }
    const rules = await priceRuleModel.findByListId(listId);
    res.json(rules);
  },

  /**
   * GET /api/pricing/rules/:id
   * Get a single rule
   */
  getRule: async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ValidationError('Invalid ID');
    }
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

    await auditService.logFromRequest({
      req, action: 'CREATE', entityType: 'price_rule',
      entityId: rule.id, entityName: `Regel #${rule.id} (liste ${rule.price_list_id})`,
    });

    res.status(201).json(rule);
  },

  /**
   * PUT /api/pricing/rules/:id
   * Update a price rule
   */
  updateRule: async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ValidationError('Invalid ID');
    }
    const data: UpdatePriceRuleInput = req.body;

    if (data.discount_percent !== undefined && data.fixed_price !== undefined
        && data.discount_percent !== null && data.fixed_price !== null) {
      throw new ValidationError('Cannot set both discount_percent and fixed_price');
    }

    const existing = await priceRuleModel.findById(id);
    if (!existing) {
      throw new NotFoundError('Price rule not found');
    }

    // Merge-validate against stored row: final state must have exactly one mechanism.
    // Prevents DB chk_discount_type 500 -> return 400 instead.
    const mergedDiscount =
      data.discount_percent !== undefined ? data.discount_percent : existing.discount_percent;
    const mergedFixed =
      data.fixed_price !== undefined ? data.fixed_price : existing.fixed_price;
    if ((mergedDiscount != null) === (mergedFixed != null)) {
      throw new ValidationError('Exactly one of discount_percent or fixed_price must be set');
    }

    const rule = await priceRuleModel.update(id, data);
    if (!rule) {
      throw new NotFoundError('Price rule not found');
    }

    await auditService.logFromRequest({
      req, action: 'UPDATE', entityType: 'price_rule',
      entityId: id, entityName: `Regel #${id} (liste ${existing.price_list_id})`,
      oldData: existing as any, newData: rule as any,
    });

    res.json(rule);
  },

  /**
   * DELETE /api/pricing/rules/:id
   * Delete a price rule
   */
  deleteRule: async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      throw new ValidationError('Invalid ID');
    }

    const oldRule = await priceRuleModel.findById(id);
    const deleted = await priceRuleModel.delete(id);

    if (!deleted) {
      throw new NotFoundError('Price rule not found');
    }

    await auditService.logFromRequest({
      req, action: 'DELETE', entityType: 'price_rule',
      entityId: id, entityName: `Regel #${id}`, oldData: oldRule as any,
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
    const { price_list_id, varekode, varegruppe, kundenr, customer_group_id, min_quantity, exclude_rule_id } = req.body as {
      price_list_id: number;
      varekode?: string | null;
      varegruppe?: string | null;
      kundenr?: string | null;
      customer_group_id?: number | null;
      min_quantity?: number;
      exclude_rule_id?: number;
    };

    if (!price_list_id) {
      throw new ValidationError('price_list_id is required');
    }

    const conflicts = await detectConflicts(
      { price_list_id, varekode, varegruppe, kundenr, customer_group_id, min_quantity },
      exclude_rule_id ?? undefined
    );

    res.json(conflicts);
  },
};
