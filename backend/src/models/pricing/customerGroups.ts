import { query, transaction } from '../../db/index.js';
import type { SqlParams } from '../../db/index.js';
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
   * Update a customer group (dynamic SET to allow explicit null clearing).
   */
  update: async (id: number, data: Partial<CreateCustomerGroupInput>): Promise<CustomerGroup | null> => {
    const setClauses: string[] = [];
    const values: SqlParams = [id];
    let paramIndex = 2;

    if ('name' in data) {
      setClauses.push(`name = $${paramIndex}`);
      values.push(data.name ?? null);
      paramIndex++;
    }
    if ('description' in data) {
      setClauses.push(`description = $${paramIndex}`);
      values.push(data.description ?? null);
    }

    if (setClauses.length === 0) {
      const existing = await query('SELECT * FROM customer_group WHERE id = $1', [id]);
      return existing.rows[0] || null;
    }

    const result = await query(
      `UPDATE customer_group SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Delete a customer group (transactional: null out refs first).
   */
  delete: async (id: number): Promise<boolean> => {
    return transaction(async (client) => {
      // Null out member refs + rule refs (rules become wildcard for group scope)
      await client.query('UPDATE kunde SET customer_group_id = NULL WHERE customer_group_id = $1', [id]);
      await client.query('UPDATE price_rule SET customer_group_id = NULL WHERE customer_group_id = $1', [id]);
      const result = await client.query('DELETE FROM customer_group WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    });
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
    const values: SqlParams = [];
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
