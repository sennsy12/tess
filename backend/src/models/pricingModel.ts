import { query } from '../db/index.js';
import {
  CustomerGroup,
  CreateCustomerGroupInput,
  PriceList,
  CreatePriceListInput,
  UpdatePriceListInput,
  PriceRule,
  CreatePriceRuleInput,
  UpdatePriceRuleInput,
  CustomerWithGroup
} from '../types/pricing.js';

// ============================================
// CUSTOMER GROUP MODEL
// ============================================

export const customerGroupModel = {
  /**
   * Get all customer groups
   */
  findAll: async (): Promise<CustomerGroup[]> => {
    const result = await query(
      'SELECT * FROM customer_group ORDER BY name'
    );
    return result.rows;
  },

  /**
   * Get a customer group by ID
   */
  findById: async (id: number): Promise<CustomerGroup | null> => {
    const result = await query(
      'SELECT * FROM customer_group WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new customer group
   */
  create: async (data: CreateCustomerGroupInput): Promise<CustomerGroup> => {
    const result = await query(
      `INSERT INTO customer_group (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.description || null]
    );
    return result.rows[0];
  },

  /**
   * Update a customer group
   */
  update: async (id: number, data: Partial<CreateCustomerGroupInput>): Promise<CustomerGroup | null> => {
    const result = await query(
      `UPDATE customer_group
       SET name = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE id = $1
       RETURNING *`,
      [id, data.name, data.description]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a customer group
   */
  delete: async (id: number): Promise<boolean> => {
    // First, remove group from customers
    await query('UPDATE kunde SET customer_group_id = NULL WHERE customer_group_id = $1', [id]);
    const result = await query('DELETE FROM customer_group WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Assign a customer to a group
   */
  assignCustomer: async (kundenr: string, groupId: number | null): Promise<boolean> => {
    const result = await query(
      'UPDATE kunde SET customer_group_id = $2 WHERE kundenr = $1',
      [kundenr, groupId]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Get all customers with their group info (lightweight, for dropdowns etc.)
   */
  getCustomersWithGroups: async (): Promise<CustomerWithGroup[]> => {
    const result = await query(
      `SELECT k.kundenr, k.kundenavn, k.customer_group_id, cg.name as customer_group_name
       FROM kunde k
       LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
       ORDER BY k.kundenavn`
    );
    return result.rows;
  },

  /**
   * Search customers with groups — server-side search, filter, and pagination
   */
  searchCustomersWithGroups: async (params: {
    search?: string;
    groupId?: string;   // 'unassigned' | number as string | undefined (= all)
    page: number;
    limit: number;
  }): Promise<{ data: CustomerWithGroup[]; total: number }> => {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    // Search filter (kundenr or kundenavn)
    if (params.search && params.search.trim()) {
      conditions.push(`(k.kundenr ILIKE $${paramIdx} OR k.kundenavn ILIKE $${paramIdx})`);
      values.push(`%${params.search.trim()}%`);
      paramIdx++;
    }

    // Group filter
    if (params.groupId === 'unassigned') {
      conditions.push('k.customer_group_id IS NULL');
    } else if (params.groupId && params.groupId !== 'all') {
      conditions.push(`k.customer_group_id = $${paramIdx}`);
      values.push(parseInt(params.groupId));
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total FROM kunde k ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].total);

    // Fetch page
    const offset = (params.page - 1) * params.limit;
    const dataResult = await query(
      `SELECT k.kundenr, k.kundenavn, k.customer_group_id, cg.name as customer_group_name
       FROM kunde k
       LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
       ${whereClause}
       ORDER BY k.kundenavn
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, params.limit, offset]
    );

    return { data: dataResult.rows, total };
  }
};

// ============================================
// PRICE LIST MODEL
// ============================================

export const priceListModel = {
  /**
   * Get all price lists
   */
  findAll: async (): Promise<PriceList[]> => {
    const result = await query(
      'SELECT * FROM price_list ORDER BY priority DESC, name'
    );
    return result.rows;
  },

  /**
   * Get active price lists (valid now)
   */
  findActive: async (): Promise<PriceList[]> => {
    const result = await query(
      `SELECT * FROM price_list
       WHERE is_active = TRUE
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_to IS NULL OR valid_to >= NOW())
       ORDER BY priority DESC`
    );
    return result.rows;
  },

  /**
   * Get a price list by ID
   */
  findById: async (id: number): Promise<PriceList | null> => {
    const result = await query(
      'SELECT * FROM price_list WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new price list
   */
  create: async (data: CreatePriceListInput): Promise<PriceList> => {
    const result = await query(
      `INSERT INTO price_list (name, description, valid_from, valid_to, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.description || null,
        data.valid_from || null,
        data.valid_to || null,
        data.priority ?? 0,
        data.is_active ?? true
      ]
    );
    return result.rows[0];
  },

  /**
   * Update a price list
   */
  update: async (id: number, data: UpdatePriceListInput): Promise<PriceList | null> => {
    const result = await query(
      `UPDATE price_list
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           valid_from = COALESCE($4, valid_from),
           valid_to = COALESCE($5, valid_to),
           priority = COALESCE($6, priority),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.name,
        data.description,
        data.valid_from,
        data.valid_to,
        data.priority,
        data.is_active
      ]
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a price list (cascades to rules)
   */
  delete: async (id: number): Promise<boolean> => {
    const result = await query('DELETE FROM price_list WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
};

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
        data.customer_group_id || null,
        data.min_quantity ?? 1,
        data.discount_percent || null,
        data.fixed_price || null
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
    const values: any[] = [id];
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
    customerGroupId?: number;
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
         pr.min_quantity DESC`,
      [params.varekode, params.varegruppe || null, params.kundenr, params.customerGroupId || null, params.quantity]
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

