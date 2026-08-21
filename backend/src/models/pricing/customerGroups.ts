import { query } from '../../db/index.js';
import { extractWindowCountPage } from '../../lib/paginatedQuery.js';
import { buildOrderByClause } from '../../lib/sqlSort.js';
import { toIlikeContains } from '../../lib/sqlSearch.js';
import {
  CustomerGroup,
  CreateCustomerGroupInput,
  CustomerWithGroup
} from '../../types/pricing.js';

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
    groupId?: string;
    page: number;
    limit: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ data: CustomerWithGroup[]; total: number }> => {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.search?.trim()) {
      conditions.push(`(k.kundenr ILIKE $${paramIdx} OR k.kundenavn ILIKE $${paramIdx})`);
      values.push(toIlikeContains(params.search));
      paramIdx++;
    }

    if (params.groupId === 'unassigned') {
      conditions.push('k.customer_group_id IS NULL');
    } else if (params.groupId === 'assigned') {
      conditions.push('k.customer_group_id IS NOT NULL');
    } else if (params.groupId && params.groupId !== 'all') {
      conditions.push(`k.customer_group_id = $${paramIdx}`);
      values.push(parseInt(params.groupId, 10));
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = buildOrderByClause(
      {
        kundenr: 'k.kundenr',
        kundenavn: 'k.kundenavn',
        group: 'cg.name',
      },
      params.sortBy,
      params.sortDir,
      'k.kundenavn',
    );
    const offset = (params.page - 1) * params.limit;

    const dataResult = await query(
      `SELECT k.kundenr, k.kundenavn, k.customer_group_id, cg.name AS customer_group_name,
              COUNT(*) OVER()::int AS _total_count
       FROM kunde k
       LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, params.limit, offset],
    );

    const { data, total } = extractWindowCountPage(dataResult.rows);

    return { data, total };
  },
};
