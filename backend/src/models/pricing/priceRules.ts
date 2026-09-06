import { query } from '../../db/index.js';
import type { SqlParams } from '../../db/index.js';
import {
  PriceRule,
  CreatePriceRuleInput,
  UpdatePriceRuleInput
} from '../../types/pricing.js';

// ============================================
// PRICE RULE MODEL
// ============================================

export const priceRuleModel = {
  /**
   * Get all rules for a price list
   */
  findByListId: async (priceListId: number): Promise<PriceRule[]> => {
    const result = await query(
      `SELECT pr.*, pl.name as price_list_name, cg.name as customer_group_name
       FROM price_rule pr
       LEFT JOIN price_list pl ON pr.price_list_id = pl.id
       LEFT JOIN customer_group cg ON pr.customer_group_id = cg.id
       WHERE pr.price_list_id = $1
       ORDER BY pr.min_quantity DESC, pr.id`,
      [priceListId]
    );
    return result.rows;
  },

  /**
   * Get a rule by ID
   */
  findById: async (id: number): Promise<PriceRule | null> => {
    const result = await query(
      `SELECT pr.*, pl.name as price_list_name, cg.name as customer_group_name
       FROM price_rule pr
       LEFT JOIN price_list pl ON pr.price_list_id = pl.id
       LEFT JOIN customer_group cg ON pr.customer_group_id = cg.id
       WHERE pr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new price rule
   */
  create: async (data: CreatePriceRuleInput): Promise<PriceRule> => {
    const result = await query(
      `INSERT INTO price_rule 
       (price_list_id, varekode, varegruppe, kundenr, customer_group_id, min_quantity, discount_percent, fixed_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.price_list_id,
        data.varekode || null,
        data.varegruppe || null,
        data.kundenr || null,
        data.customer_group_id ?? null,
        data.min_quantity ?? 1,
        data.discount_percent ?? null,
        data.fixed_price ?? null
      ]
    );
    return result.rows[0];
  },

  /**
   * Update a price rule
   * Builds dynamic SET clause to properly handle null values
   */
  update: async (id: number, data: UpdatePriceRuleInput): Promise<PriceRule | null> => {
    const setClauses: string[] = [];
    const values: SqlParams = [id];
    let paramIndex = 2;

    const fields: Array<{ key: keyof UpdatePriceRuleInput; column: string }> = [
      { key: 'varekode', column: 'varekode' },
      { key: 'varegruppe', column: 'varegruppe' },
      { key: 'kundenr', column: 'kundenr' },
      { key: 'customer_group_id', column: 'customer_group_id' },
      { key: 'min_quantity', column: 'min_quantity' },
      { key: 'discount_percent', column: 'discount_percent' },
      { key: 'fixed_price', column: 'fixed_price' },
    ];

    for (const field of fields) {
      if (field.key in data) {
        setClauses.push(`${field.column} = $${paramIndex}`);
        values.push(data[field.key] ?? null);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return await priceRuleModel.findById(id);
    }

    const result = await query(
      `UPDATE price_rule SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a price rule
   */
  delete: async (id: number): Promise<boolean> => {
    const result = await query('DELETE FROM price_rule WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Find applicable rules for a product/customer combination
   * This is the core query for price calculation
   */
  findApplicable: async (params: {
    varekode: string;
    varegruppe?: string;
    kundenr: string;
    customerGroupId?: number | null;
    quantity: number;
  }): Promise<PriceRule[]> => {
    const result = await query(
      `SELECT pr.*, pl.name as price_list_name, pl.priority as list_priority
       FROM price_rule pr
       INNER JOIN price_list pl ON pr.price_list_id = pl.id
       WHERE pl.is_active = TRUE
         AND (pl.valid_from IS NULL OR pl.valid_from <= NOW())
         AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
         AND pr.min_quantity <= $5
         AND (
           -- Product match: specific product OR product group OR all products
           (pr.varekode = $1 OR pr.varegruppe = $2 OR (pr.varekode IS NULL AND pr.varegruppe IS NULL))
         )
         AND (
           -- Customer match: specific customer OR customer group OR all customers
           (pr.kundenr = $3 OR pr.customer_group_id = $4 OR (pr.kundenr IS NULL AND pr.customer_group_id IS NULL))
         )
       ORDER BY 
         pl.priority DESC,
         -- Prefer specific product over group over all
         CASE WHEN pr.varekode IS NOT NULL THEN 0 WHEN pr.varegruppe IS NOT NULL THEN 1 ELSE 2 END,
         -- Prefer specific customer over group over all
         CASE WHEN pr.kundenr IS NOT NULL THEN 0 WHEN pr.customer_group_id IS NOT NULL THEN 1 ELSE 2 END,
          -- Prefer higher quantity threshold
          pr.min_quantity DESC,
          pr.id ASC`,
      [params.varekode, params.varegruppe || null, params.kundenr, params.customerGroupId ?? null, params.quantity]
    );
    return result.rows;
  },

  /**
   * Bulk variant of findApplicable: fetch candidate rules for many items in
   * ONE round-trip. Caller filters per-item by quantity + product match.
   *
   * We filter SQL by maxQuantity (min_quantity <= max) and do the exact
   * per-item quantity check in JS, since items can have different quantities.
   * Result keeps the same global ORDER BY as findApplicable, so the first
   * matching rule per item is the best rule.
   */
  findApplicableBulk: async (params: {
    varekoder: string[];
    varegrupper: Array<string | null>;
    kundenr: string;
    customerGroupId?: number | null;
    maxQuantity: number;
  }): Promise<PriceRule[]> => {
    if (params.varekoder.length === 0) return [];
    // Dedupe + drop nulls for ANY() params; NULL varegruppe never matches
    // pr.varegruppe = ANY() anyway, but keeps the arrays small.
    const varekoder = [...new Set(params.varekoder)];
    const varegrupper = [...new Set(params.varegrupper.filter((g): g is string => g != null))];
    const result = await query(
      `SELECT pr.*, pl.name as price_list_name, pl.priority as list_priority
       FROM price_rule pr
       INNER JOIN price_list pl ON pr.price_list_id = pl.id
       WHERE pl.is_active = TRUE
         AND (pl.valid_from IS NULL OR pl.valid_from <= NOW())
         AND (pl.valid_to IS NULL OR pl.valid_to >= NOW())
         AND pr.min_quantity <= $5
         AND (
           (pr.varekode = ANY($1) OR pr.varegruppe = ANY($2) OR (pr.varekode IS NULL AND pr.varegruppe IS NULL))
         )
         AND (
           (pr.kundenr = $3 OR pr.customer_group_id = $4 OR (pr.kundenr IS NULL AND pr.customer_group_id IS NULL))
         )
        ORDER BY
          pl.priority DESC,
          CASE WHEN pr.varekode IS NOT NULL THEN 0 WHEN pr.varegruppe IS NOT NULL THEN 1 ELSE 2 END,
          CASE WHEN pr.kundenr IS NOT NULL THEN 0 WHEN pr.customer_group_id IS NOT NULL THEN 1 ELSE 2 END,
          pr.min_quantity DESC,
          pr.id ASC`,
      [varekoder, varegrupper, params.kundenr, params.customerGroupId ?? null, params.maxQuantity]
    );
    return result.rows;
  },

  /**
   * Get customers with the largest price deviations (special discounts)
   * Shows customers who have specific pricing rules that differ most from base prices
   */
  getPriceDeviations: async (limit: number = 10) => {
    const sql = `
      SELECT 
        k.kundenr,
        k.kundenavn,
        cg.name as customer_group_name,
        COUNT(DISTINCT pr.id) as rule_count,
        AVG(pr.discount_percent) as avg_discount,
        MAX(pr.discount_percent) as max_discount
      FROM kunde k
      LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
      INNER JOIN price_rule pr ON (pr.kundenr = k.kundenr OR pr.customer_group_id = k.customer_group_id)
      INNER JOIN price_list pl ON pr.price_list_id = pl.id
      WHERE pl.is_active = TRUE
        AND pr.discount_percent IS NOT NULL
        AND pr.discount_percent > 0
      GROUP BY k.kundenr, k.kundenavn, cg.name
      ORDER BY max_discount DESC NULLS LAST
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    return result.rows;
  }
};
