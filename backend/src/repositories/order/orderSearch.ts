/**
 * Reference search across `ordre_henvisning` (henvisning1–5).
 * Kunde-scoped in SQL.
 *
 * Always paginated with `COUNT(*) OVER()` (same `{ data, total }` envelope
 * as `findOrders`). The match runs in an EXISTS semi-join so a multi-line
 * hit can never multiply `ordre` rows — the window count therefore equals
 * the distinct-order match count (see the comment inside the function for
 * the measured fan-out bug this replaced).
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
  // Matching rows live in `ordre_henvisning` (one per order line). The match
  // runs inside EXISTS so a multi-line hit can never multiply the `ordre`
  // rows: the previous INNER JOIN form combined with `COUNT(*) OVER()`
  // counted line rows BEFORE the SELECT DISTINCT collapsed them, inflating
  // `total` up to the average-lines-per-order factor (measured 3428 vs the
  // true 1150 orders on the dev dataset — ~3x phantom pagination pages).
  // EXISTS also lets the planner use the trigram indexes on
  // `ordre_henvisning.henvisning1-5` (migration 004) from the inside out.
  let sql = `
      SELECT o.*, k.kundenavn, f.firmanavn,
        COUNT(*) OVER()::int AS _total_count
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      WHERE EXISTS (
        SELECT 1
        FROM ordrelinje ol
        INNER JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
        WHERE ol.ordrenr = o.ordrenr
          AND (
            oh.henvisning1 ILIKE $1 OR
            oh.henvisning2 ILIKE $1 OR
            oh.henvisning3 ILIKE $1 OR
            oh.henvisning4 ILIKE $1 OR
            oh.henvisning5 ILIKE $1
          )
      )
    `;
  const params: Array<string | number> = [toIlikeContains(q)];

  if (user?.role === 'kunde' && user?.kundenr) {
    sql += ` AND o.kundenr = $2`;
    params.push(user.kundenr);
  }

  sql += ' ORDER BY o.dato DESC';

  // Window count is computed before LIMIT/OFFSET, so _total_count is the
  // full match count — now over distinct orders, not line rows.
  const limitIndex = params.length + 1;
  const offsetIndex = params.length + 2;
  sql += ` LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
  params.push(limit, offset);

  const result = await query(sql, params as unknown[]);
  return extractWindowCountPage(result.rows);
}

