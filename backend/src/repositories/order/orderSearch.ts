/**
 * Reference search across `ordre_henvisning` (henvisning1–5).
 * Kunde-scoped in SQL.
 *
 * @module repositories/order/orderSearch
 */
import { query } from '../../db/index.js';
import { toIlikeContains } from '../../lib/sqlSearch.js';
import type { OrderFilterScope } from './orderFilters.js';

export async function searchOrdersByReference(
  q: string,
  user?: OrderFilterScope,
): Promise<Array<Record<string, any>>> {
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
  const params: Array<string | number> = [toIlikeContains(q)];

  if (user?.role === 'kunde' && user?.kundenr) {
    sql += ` AND o.kundenr = $2`;
    params.push(user.kundenr);
  }

  sql += ' ORDER BY o.dato DESC';

  const result = await query(sql, params as unknown[]);
  return result.rows;
}

