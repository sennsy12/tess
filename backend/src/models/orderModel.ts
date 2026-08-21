/**
 * Order Model
 *
 * Handles database operations for the `ordre` table, including
 * filtered listing, detail retrieval, line-item queries, and
 * reference-based search.
 *
 * @module models/orderModel
 */
import { query } from '../db/index.js';
import { extractWindowCountPage } from '../lib/paginatedQuery.js';
import { buildOrderByClause } from '../lib/sqlSort.js';
import { toIlikeContains } from '../lib/sqlSearch.js';
import type { OrderWorkflowStatus } from '../lib/orderWorkflow.js';
import { KUNDE_CANCELLABLE_STATUSES } from '../lib/orderWorkflow.js';

/** Filter parameters accepted by `findAll`. */
export interface OrderFilters {
  kundenr?: string;
  ordrenr?: string;
  startDate?: string;
  endDate?: string;
  firmaid?: number;
  lagernavn?: string;
  valutaid?: string;
  search?: string;
  workflowStatus?: OrderWorkflowStatus;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const ORDER_SORT_COLUMNS: Record<string, string> = {
  ordrenr: 'o.ordrenr',
  dato: 'o.dato',
  kundenavn: 'k.kundenavn',
  kunderef: 'o.kunderef',
  firmanavn: 'f.firmanavn',
  lagernavn: 'o.lagernavn',
  valutaid: 'o.valutaid',
  sum: 'o.sum',
  workflow_status: 'o.workflow_status',
};

export const orderModel = {
  /**
   * List orders with dynamic filtering and optional pagination.
   *
   * When the caller is a `kunde` user, results are automatically scoped
   * to that customer's orders for row-level security.
   *
   * @param filters    - Dynamic filter criteria
   * @param user       - Authenticated user context (used for role-based scoping)
   * @param pagination - Optional `{ limit, offset }` for server-side paging
   * @returns `{ data, total }` where `data` is the current page of orders
   */
  findAll: async (
    filters: OrderFilters, 
    user?: { role: string; kundenr?: string },
    pagination?: { limit: number; offset: number }
  ) => {
    let baseSql = `
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      baseSql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    } else if (filters.kundenr) {
      baseSql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    if (filters.ordrenr) {
      baseSql += ` AND o.ordrenr::text LIKE $${paramIndex++}`;
      params.push(`%${filters.ordrenr}%`);
    }

    if (filters.startDate) {
      baseSql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      baseSql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.firmaid) {
      baseSql += ` AND o.firmaid = $${paramIndex++}`;
      params.push(filters.firmaid);
    }

    if (filters.lagernavn) {
      baseSql += ` AND o.lagernavn = $${paramIndex++}`;
      params.push(filters.lagernavn);
    }

    if (filters.valutaid) {
      baseSql += ` AND o.valutaid = $${paramIndex++}`;
      params.push(filters.valutaid);
    }

    if (filters.workflowStatus) {
      baseSql += ` AND o.workflow_status = $${paramIndex++}`;
      params.push(filters.workflowStatus);
    }

    if (filters.search) {
      baseSql += ` AND (
        o.kundeordreref ILIKE $${paramIndex} OR 
        o.kunderef ILIKE $${paramIndex} OR
        k.kundenavn ILIKE $${paramIndex} OR
        o.kundenr ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM ordrelinje ol2
          INNER JOIN ordre_henvisning oh ON ol2.ordrenr = oh.ordrenr AND ol2.linjenr = oh.linjenr
          WHERE ol2.ordrenr = o.ordrenr
          AND (
            oh.henvisning1 ILIKE $${paramIndex} OR
            oh.henvisning2 ILIKE $${paramIndex} OR
            oh.henvisning3 ILIKE $${paramIndex} OR
            oh.henvisning4 ILIKE $${paramIndex} OR
            oh.henvisning5 ILIKE $${paramIndex}
          )
        )
      )`;
      params.push(toIlikeContains(filters.search));
      paramIndex++;
    }

    const orderBy = filters.sortBy
      ? buildOrderByClause(ORDER_SORT_COLUMNS, filters.sortBy, filters.sortDir, 'o.dato')
      : 'o.dato DESC, o.ordrenr DESC';

    let dataSql = `SELECT o.*, k.kundenavn, f.firmanavn,
                          COUNT(*) OVER()::int AS _total_count
                   ${baseSql}
                   ORDER BY ${orderBy}`;

    if (pagination) {
      dataSql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(pagination.limit, pagination.offset);
    }

    const result = await query(dataSql, params);
    const { data, total } = extractWindowCountPage(result.rows);

    return {
      data,
      total,
    };
  },

  /**
   * Retrieve a single order by its order number, joining customer,
   * company, and warehouse data. Respects row-level security for
   * `kunde` users.
   *
   * @param ordrenr - The order number to look up
   * @param user    - Authenticated user context
   * @returns The order row or `undefined` if not found / not authorised
   */
  findByOrderNr: async (ordrenr: number, user?: { role: string; kundenr?: string }) => {
    let sql = `
      SELECT o.*, k.kundenavn, f.firmanavn, l.lagernavn as lager_display
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      LEFT JOIN lager l ON o.lagernavn = l.lagernavn AND o.firmaid = l.firmaid
      WHERE o.ordrenr = $1
    `;
    const params: any[] = [ordrenr];

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $2`;
      params.push(user.kundenr);
    }

    const result = await query(sql, params);
    return result.rows[0];
  },

  /**
   * Fetch all line items for an order, joined with product details
   * and reference records.
   *
   * @param ordrenr - Order number whose lines to retrieve
   * @returns Array of line-item rows enriched with product/reference data
   */
  findLines: async (ordrenr: number) => {
    const result = await query(
      `SELECT ol.*, v.varenavn, v.varegruppe,
              oh.henvisning1, oh.henvisning2, oh.henvisning3, oh.henvisning4, oh.henvisning5
       FROM ordrelinje ol
       LEFT JOIN vare v ON ol.varekode = v.varekode
       LEFT JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
       WHERE ol.ordrenr = $1
       ORDER BY ol.linjenr`,
      [ordrenr]
    );
    return result.rows;
  },

  /**
   * Full-text search across order reference fields (henvisning1–5).
   * Results are scoped to the authenticated user when applicable.
   *
   * @param q    - Search term (ILIKE matched against all reference columns)
   * @param user - Authenticated user context
   * @returns Distinct orders matching the reference search
   */
  searchReferences: async (q: string, user?: { role: string; kundenr?: string }) => {
    let sql = `
      SELECT DISTINCT o.*, k.kundenavn, f.firmanavn
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      INNER JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr
      INNER JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
      WHERE (
        oh.henvisning1 ILIKE $1 OR
        oh.henvisning2 ILIKE $1 OR
        oh.henvisning3 ILIKE $1 OR
        oh.henvisning4 ILIKE $1 OR
        oh.henvisning5 ILIKE $1
      )
    `;
    const params: any[] = [toIlikeContains(q)];

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $2`;
      params.push(user.kundenr);
    }

    sql += ' ORDER BY o.dato DESC';

    const result = await query(sql, params);
    return result.rows;
  },

  updateWorkflowStatus: async (
    ordrenr: number,
    workflowStatus: OrderWorkflowStatus,
  ): Promise<{ ordrenr: number; kundenr: string; workflow_status: OrderWorkflowStatus } | null> => {
    const result = await query(
      `UPDATE ordre
       SET workflow_status = $2, status_updated_at = NOW()
       WHERE ordrenr = $1
       RETURNING ordrenr, kundenr, workflow_status`,
      [ordrenr, workflowStatus],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0];
  },

  getWorkflowStatus: async (ordrenr: number): Promise<OrderWorkflowStatus | null> => {
    const result = await query(
      `SELECT workflow_status FROM ordre WHERE ordrenr = $1`,
      [ordrenr],
    );
    return result.rows[0]?.workflow_status ?? null;
  },

  /**
   * Cancel an order that is still awaiting approval.
   * Scoped to `pending_approval`/`approved` and, for kunde users,
   * to their own orders — enforced in SQL so no TOCTOU window exists.
   *
   * @returns The cancelled order's ordrenr/kundenr, or `null` when the
   *          order doesn't exist, isn't owned, or isn't cancellable
   */
  cancelByOwner: async (
    ordrenr: number,
    user: { role: string; kundenr?: string },
  ): Promise<{ ordrenr: number; kundenr: string; workflow_status: OrderWorkflowStatus } | null> => {
    let sql = `
      UPDATE ordre
      SET workflow_status = 'cancelled', status_updated_at = NOW()
      WHERE ordrenr = $1
        AND workflow_status = ANY($2::text[])
    `;
    const params: any[] = [ordrenr, [...KUNDE_CANCELLABLE_STATUSES]];

    if (user.role === 'kunde' && user.kundenr) {
      sql += ` AND kundenr = $3`;
      params.push(user.kundenr);
    }

    sql += ` RETURNING ordrenr, kundenr, workflow_status`;

    const result = await query(sql, params);
    return result.rows[0] ?? null;
  },
};
