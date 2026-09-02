/**
 * Pure SQL-filter builder for the `ordre` list query.
 *
 * Extracted from `models/orderModel.findAll` so the WHERE logic is
 * unit-testable without a database and reusable across
 * findAll / exports / counts.
 *
 * @module repositories/order/orderFilters
 */
import { toIlikeContains } from '../../lib/sqlSearch.js';

export interface OrderFilterInput {
  kundenr?: string;
  ordrenr?: string;
  startDate?: string;
  endDate?: string;
  firmaid?: number;
  lagernavn?: string;
  valutaid?: string;
  search?: string;
  workflowStatus?: string;
}

export interface OrderFilterScope {
  role?: string;
  kundenr?: string;
}

/** Named alias for pg bind params (avoids `any[]`). */
export type SqlParams = Array<string | number | null>;

/**
 * Append order-list WHERE clauses to `baseSql`.
 * Mutates `params` in place, returns the extended SQL + next param index.
 * Kunde scope always wins over the `kundenr` filter (row-level security).
 */
export function applyOrderFilters(
  baseSql: string,
  params: SqlParams,
  filters: OrderFilterInput,
  user?: OrderFilterScope,
): { sql: string; nextIndex: number } {
  let sql = baseSql;
  let paramIndex = params.length + 1;

  // If user is kunde, only show their orders
  if (user?.role === 'kunde' && user?.kundenr) {
    sql += ` AND o.kundenr = $${paramIndex++}`;
    params.push(user.kundenr);
  } else if (filters.kundenr) {
    sql += ` AND o.kundenr = $${paramIndex++}`;
    params.push(filters.kundenr);
  }

  if (filters.ordrenr) {
    sql += ` AND o.ordrenr::text LIKE $${paramIndex++}`;
    params.push(`%${filters.ordrenr}%`);
  }

  if (filters.startDate) {
    sql += ` AND o.dato >= $${paramIndex++}`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ` AND o.dato <= $${paramIndex++}`;
    params.push(filters.endDate);
  }

  if (filters.firmaid) {
    sql += ` AND o.firmaid = $${paramIndex++}`;
    params.push(filters.firmaid);
  }

  if (filters.lagernavn) {
    sql += ` AND o.lagernavn = $${paramIndex++}`;
    params.push(filters.lagernavn);
  }

  if (filters.valutaid) {
    sql += ` AND o.valutaid = $${paramIndex++}`;
    params.push(filters.valutaid);
  }

  if (filters.workflowStatus) {
    sql += ` AND o.workflow_status = $${paramIndex++}`;
    params.push(filters.workflowStatus);
  }

  if (filters.search) {
    sql += ` AND (
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

  return { sql, nextIndex: paramIndex };
}

/** Base FROM/JOIN/WHERE every order list query starts from. */
export const ORDER_LIST_BASE_SQL = `
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      WHERE 1=1
    `;
