/**
 * Reference search across `ordre_henvisning` (henvisning1–5).
 * Kunde-scoped in SQL.
 *
 * Always paginated with `COUNT(*) OVER()` (same `{ data, total }` envelope
 * as `findOrders`) so reference searches can never trigger an unbounded
 * DISTINCT scan. Callers that omit `pagination` get page 1 with the default
 * page size — existing calls without params keep working.
 *
 * @module repositories/order/orderSearch
 */
import { query } from '../../db/index.js';
import { toIlikeContains } from '../../lib/sqlSearch.js';
import { extractWindowCountPage } from '../../lib/paginatedQuery.js';
import type { OrderFilterScope } from './orderFilters.js';

/** Default page size for reference search (matches order-list defaults). */
export const ORDER_SEARCH_DEFAULT_LIMIT = 50;
/** Hard cap: blocks runaway scans even when callers ask for more. */
export const ORDER_SEARCH_MAX_LIMIT = 200;

export interface OrderSearchPagination {
  limit?: number;
  offset?: number;
}

function normalizeSearchPagination(pagination?: OrderSearchPagination): { limit: number; offset: number } {
  const requested = Number.isFinite(pagination?.limit) ? Math.floor(pagination!.limit as number) : ORDER_SEARCH_DEFAULT_LIMIT;
  const limit = Math.min(ORDER_SEARCH_MAX_LIMIT, Math.max(1, requested));
  const offset = Number.isFinite(pagination?.offset) ? Math.max(0, Math.floor(pagination!.offset as number)) : 0;
  return { limit, offset };
}

export async function searchOrdersByReference(
  q: string,
  user?: OrderFilterScope,
  pagination?: OrderSearchPagination,
): Promise<{ data: Array<Record<string, any>>; total: number }> {
  const { limit, offset } = normalizeSearchPagination(pagination);
  let sql = `
      SELECT DISTINCT o.*, k.kundenavn, f.firmanavn,
        COUNT(*) OVER()::int AS _total_count
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
  const params: Array<string | number> = [toIlikeContains(q)];

  if (user?.role === 'kunde' && user?.kundenr) {
    sql += ` AND o.kundenr = $2`;
    params.push(user.kundenr);
  }

  sql += ' ORDER BY o.dato DESC';

  // Window count is computed before LIMIT/OFFSET, so _total_count is the
  // full match count (same pattern as findOrders).
  const limitIndex = params.length + 1;
  const offsetIndex = params.length + 2;
  sql += ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
  params.push(limit, offset);

  const result = await query(sql, params as unknown[]);
  return extractWindowCountPage(result.rows);
}

