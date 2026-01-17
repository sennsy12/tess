import { customerGroupModel, priceListModel, priceRuleModel } from '../models/pricingModel.js';
import { PriceCalculationInput, PriceCalculationResult, PriceRule } from '../types/pricing.js';
import { query } from '../db/index.js';

/**
 * Pricing Service
 * Core business logic for price calculations
 */
export const pricingService = {
  /**
   * Calculate the best price for a product given customer context
   * 
   * Algorithm:
   * 1. Get customer's group
   * 2. Find all applicable rules (matching product/customer, valid dates, sufficient quantity)
   * 3. Rules are pre-sorted by priority and specificity
   * 4. Apply the best (first) rule if any
   * 5. Return calculation result with full metadata
   */
  calculatePrice: async (input: PriceCalculationInput): Promise<PriceCalculationResult> => {
    const { varekode, varegruppe, kundenr, quantity, base_price } = input;

    // Get customer's group
    const customerResult = await query(
      'SELECT customer_group_id FROM kunde WHERE kundenr = $1',
      [kundenr]
    );
    const customerGroupId = customerResult.rows[0]?.customer_group_id || null;

    // Find applicable rules (already sorted by priority/specificity)
    const applicableRules = await priceRuleModel.findApplicable({
      varekode,
      varegruppe,
      kundenr,
      customerGroupId,
      quantity
    });

    // Default result: no discount
    const result: PriceCalculationResult = {
      original_price: base_price * quantity,
      final_price: base_price * quantity,
      unit_price: base_price,
      discount_applied: false,
      discount_percent: null,
      discount_amount: 0,
      applied_rule_id: null,
      applied_rule_name: null,
      applied_list_name: null
    };

    // No applicable rules
    if (applicableRules.length === 0) {
      return result;
    }

    // Apply the best rule (first in sorted list)
    const bestRule = applicableRules[0] as PriceRule & { price_list_name: string; list_priority: number };
    
    let finalUnitPrice = base_price;

    if (bestRule.fixed_price !== null) {
      // Fixed price override
      finalUnitPrice = Number(bestRule.fixed_price);
      result.discount_percent = Math.round(((base_price - finalUnitPrice) / base_price) * 100 * 100) / 100;
    } else if (bestRule.discount_percent !== null) {
      // Percentage discount
      const discountMultiplier = 1 - (Number(bestRule.discount_percent) / 100);
      finalUnitPrice = Math.round(base_price * discountMultiplier * 100) / 100;
      result.discount_percent = Number(bestRule.discount_percent);
    }

    result.unit_price = finalUnitPrice;
    result.final_price = Math.round(finalUnitPrice * quantity * 100) / 100;
    result.discount_amount = Math.round((result.original_price - result.final_price) * 100) / 100;
    result.discount_applied = result.discount_amount > 0;
    result.applied_rule_id = bestRule.id;
    result.applied_rule_name = pricingService.formatRuleName(bestRule);
    result.applied_list_name = bestRule.price_list_name;

    return result;
  },

  /**
   * Format a human-readable rule name
   */
  formatRuleName: (rule: PriceRule): string => {
    const parts: string[] = [];

    if (rule.discount_percent !== null) {
      parts.push(`${rule.discount_percent}% rabatt`);
    } else if (rule.fixed_price !== null) {
      parts.push(`Fast pris ${rule.fixed_price}`);
    }

    if (rule.varekode) {
      parts.push(`på ${rule.varekode}`);
    } else if (rule.varegruppe) {
      parts.push(`på ${rule.varegruppe}`);
    }

    if (rule.min_quantity > 1) {
      parts.push(`ved ${rule.min_quantity}+ stk`);
    }

    return parts.join(' ') || 'Prisregel';
  },

  /**
   * Get all applicable rules for a customer (for UI preview)
   */
  getApplicableRulesForCustomer: async (kundenr: string): Promise<PriceRule[]> => {
    // Get customer's group
    const customerResult = await query(
      'SELECT customer_group_id FROM kunde WHERE kundenr = $1',
      [kundenr]
    );
    const customerGroupId = customerResult.rows[0]?.customer_group_id || null;

    // Get all active rules for this customer or their group
    const result = await query(
      `SELECT pr.*, pl.name as price_list_name, cg.name as customer_group_name
       FROM price_rule pr
       INNER JOIN price_list pl ON pr.price_list_id = pl.id
       LEFT JOIN customer_group cg ON pr.customer_group_id = cg.id
       WHERE pl.is_active = TRUE
         AND (pl.valid_from IS NULL OR pl.valid_from <= NOW())
         AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
         AND (
           pr.kundenr = $1 
           OR pr.customer_group_id = $2 
           OR (pr.kundenr IS NULL AND pr.customer_group_id IS NULL)
         )
       ORDER BY pl.priority DESC, pr.min_quantity DESC`,
      [kundenr, customerGroupId]
    );

    return result.rows;
  },

  /**
   * Bulk calculate prices for multiple items (e.g., for order display)
   */
  calculatePricesForOrder: async (
    items: Array<{ varekode: string; varegruppe?: string; quantity: number; base_price: number }>,
    kundenr: string
  ): Promise<PriceCalculationResult[]> => {
    const results: PriceCalculationResult[] = [];

    for (const item of items) {
      const result = await pricingService.calculatePrice({
        varekode: item.varekode,
        varegruppe: item.varegruppe,
        kundenr,
        quantity: item.quantity,
        base_price: item.base_price
      });
      results.push(result);
    }

    return results;
  }
};
