/**
 * Read queries for the `ordre` table: filtered listing + detail + lines.
 *
 * @module repositories/order/orderFinder
 */
import { query } from '../../db/index.js';
import { extractWindowCountPage } from '../../lib/paginatedQuery.js';
import { buildOrderByClause } from '../../lib/sqlSort.js';
import {
  ORDER_LIST_BASE_SQL,
  applyOrderFilters,
  type OrderFilterInput,
  type OrderFilterScope,
  type SqlParams,
} from './orderFilters.js';

/** Line row: totals fields required, everything else open (joins). */
export interface OrderLineRow {
  antall: number;
  nettpris: number;
  linjesum?: number;
  [key: string]: any;
}

/** Sortable columns whitelist for the order list. */
export const ORDER_SORT_COLUMNS: Record<string, string> = {
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

export interface OrderListFilters extends OrderFilterInput {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * List orders with dynamic filtering and optional pagination.
 * Kunde users are automatically scoped to their own orders.
 */
export async function findOrders(
  filters: OrderListFilters,
  user?: OrderFilterScope,
  pagination?: { limit: number; offset: number },
): Promise<{ data: Array<Record<string, any>>; total: number }> {
  const params: SqlParams = [];
  const { sql: whereSql } = applyOrderFilters(ORDER_LIST_BASE_SQL, params, filters, user);

  const orderBy = filters.sortBy
    ? buildOrderByClause(ORDER_SORT_COLUMNS, filters.sortBy, filters.sortDir, 'o.dato')
    : 'o.dato DESC, o.ordrenr DESC';

  let dataSql = `SELECT o.*, k.kundenavn, f.firmanavn,
                          COUNT(*) OVER()::int AS _total_count
                    ${whereSql}
                    ORDER BY ${orderBy}`;

  if (pagination) {
    // applyOrderFilters leaves nextIndex = params.length + 1
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    dataSql += ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
    params.push(pagination.limit, pagination.offset);
  }

  const result = await query(dataSql, params as unknown[]);
  return extractWindowCountPage(result.rows);
}

/** Single order with customer/company/warehouse joins + kunde scoping. */
export async function findOrderByNumber(
  ordrenr: number,
  user?: OrderFilterScope,
): Promise<Record<string, any> | undefined> {
  let sql = `
      SELECT o.*, k.kundenavn, f.firmanavn, l.lagernavn as lager_display
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      LEFT JOIN lager l ON o.lagernavn = l.lagernavn AND o.firmaid = l.firmaid
      WHERE o.ordrenr = $1
    `;
  const params: SqlParams = [ordrenr];

  if (user?.role === 'kunde' && user?.kundenr) {
    sql += ` AND o.kundenr = $2`;
    params.push(user.kundenr);
  }

  const result = await query(sql, params as unknown[]);
  return result.rows[0];
}

/** All line items for an order with product + reference joins. */
export async function findOrderLines(ordrenr: number): Promise<OrderLineRow[]> {
  const result = await query(
    `SELECT ol.*, v.varenavn, v.varegruppe,
              oh.henvisning1, oh.henvisning2, oh.henvisning3, oh.henvisning4, oh.henvisning5
       FROM ordrelinje ol
       LEFT JOIN vare v ON ol.varekode = v.varekode
       LEFT JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
       WHERE ol.ordrenr = $1
       ORDER BY ol.linjenr`,
    [ordrenr],
  );
  return result.rows;
}

