import { priceRuleModel } from '../models/pricingModel.js';
import { PriceCalculationInput, PriceCalculationResult, PriceRule } from '../types/pricing.js';
import { query } from '../db/index.js';
import { applyBestRule, formatRuleName } from './pricingMath.js';

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

    // Get customer's group (skip fetch when pre-fetched for bulk)
    let customerGroupId: number | null;
    if (input.customerGroupId !== undefined) {
      customerGroupId = input.customerGroupId;
    } else {
      const customerResult = await query(
        'SELECT customer_group_id FROM kunde WHERE kundenr = $1',
        [kundenr]
      );
      customerGroupId = customerResult.rows[0]?.customer_group_id ?? null;
    }

    // Find applicable rules (already sorted by priority/specificity)
    const applicableRules = await priceRuleModel.findApplicable({
      varekode,
      varegruppe,
      kundenr,
      customerGroupId,
      quantity
    });

    // Default result: no discount
    if (applicableRules.length === 0) {
      return applyBestRule(base_price, quantity, []);
    }

    return applyBestRule(base_price, quantity, applicableRules as Array<PriceRule & { price_list_name: string }>);
  },

  /**
   * Format a human-readable rule name
   */
  formatRuleName: (rule: PriceRule): string => formatRuleName(rule),

  /**
   * Get all applicable rules for a customer (for UI preview)
   */
  getCustomerPricingOverview: async (kundenr: string) => {
    const customerResult = await query(
      `SELECT k.kundenavn, cg.name AS customer_group_name
       FROM kunde k
       LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
       WHERE k.kundenr = $1`,
      [kundenr],
    );
    const row = customerResult.rows[0];
    const rules = await pricingService.getApplicableRulesForCustomer(kundenr);

    return {
      customer: {
        kundenr,
        kundenavn: row?.kundenavn ?? null,
        customer_group_name: row?.customer_group_name ?? null,
      },
      rules,
    };
  },

  getApplicableRulesForCustomer: async (kundenr: string): Promise<PriceRule[]> => {
    // Get customer's group
    const customerResult = await query(
      'SELECT customer_group_id FROM kunde WHERE kundenr = $1',
      [kundenr]
    );
    const customerGroupId = customerResult.rows[0]?.customer_group_id ?? null;

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
    // Fetch customer group once for all items
    const customerResult = await query(
      'SELECT customer_group_id FROM kunde WHERE kundenr = $1',
      [kundenr]
    );
    const customerGroupId = customerResult.rows[0]?.customer_group_id ?? null;

    // Parallelize per-item rule lookups and calculations
    const results = await Promise.all(
      items.map((item) =>
        pricingService.calculatePrice({
          varekode: item.varekode,
          varegruppe: item.varegruppe,
          kundenr,
          quantity: item.quantity,
          base_price: item.base_price,
          customerGroupId
        })
      )
    );

    return results;
  }
};
