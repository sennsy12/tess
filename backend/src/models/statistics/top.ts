import { query } from '../../db/index.js';

/** Hard cap for top-N endpoints: blocks runaway scans. Defaults unaffected. */
const TOP_LIMIT_MAX = 200;

/**
 * Optional date-range passthrough for top-N queries.
 * Absent/empty = historic behaviour (no date filter, same SQL semantics).
 */
export interface TopStatsFilters {
  startDate?: string;
  endDate?: string;
}

function capTopLimit(limit: number, fallback: number): number {
  const requested = Number.isFinite(limit) ? Math.floor(limit) : fallback;
  return Math.min(Math.max(0, requested), TOP_LIMIT_MAX);
}

// MV OPPORTUNITY: both queries below aggregate full history on every call.
// `mv_stats_by_kunde` / `mv_stats_by_varegruppe` (005) already pre-aggregate
// the unfiltered case (see grouped.ts fast path). If these endpoints stay hot,
// serve the unfiltered default from the MVs and only hit base tables when a
// date filter is passed. No change made here — default SQL is untouched.

export const topStatsModel = {
  /**
   * Get top N products by revenue
   */
  getTopProducts: async (limit: number = 10, filters?: TopStatsFilters) => {
    const safeLimit = capTopLimit(limit, 10);
    const hasDateFilter = Boolean(filters?.startDate || filters?.endDate);
    const params: unknown[] = [];
    let dateJoin = '';
    let dateFilter = '';
    if (hasDateFilter) {
      // Joined only when a date filter is present; default query is unchanged.
      dateJoin = 'INNER JOIN ordre o ON ol.ordrenr = o.ordrenr';
      if (filters?.startDate) {
        params.push(filters.startDate);
        dateFilter += ` AND o.dato >= $${params.length}`;
      }
      if (filters?.endDate) {
        params.push(filters.endDate);
        dateFilter += ` AND o.dato <= $${params.length}`;
      }
    }
    params.push(safeLimit);
    const sql = `
      SELECT
        v.varekode,
        v.varenavn,
        v.varegruppe,
        COUNT(DISTINCT ol.ordrenr) as order_count,
        SUM(ol.antall) as total_quantity,
        SUM(ol.linjesum) as total_revenue
      FROM vare v
      INNER JOIN ordrelinje ol ON v.varekode = ol.varekode
      ${dateJoin}
      ${hasDateFilter ? 'WHERE 1=1' : ''}
      ${dateFilter}
      GROUP BY v.varekode, v.varenavn, v.varegruppe
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Get top N customers by revenue
   */
  getTopCustomers: async (limit: number = 10, filters?: TopStatsFilters) => {
    const safeLimit = capTopLimit(limit, 10);
    const params: unknown[] = [];
    let dateFilter = '';
    if (filters?.startDate) {
      params.push(filters.startDate);
      dateFilter += ` AND o.dato >= $${params.length}`;
    }
    if (filters?.endDate) {
      params.push(filters.endDate);
      dateFilter += ` AND o.dato <= $${params.length}`;
    }
    params.push(safeLimit);
    const sql = `
      SELECT
        k.kundenr,
        k.kundenavn,
        COUNT(DISTINCT o.ordrenr) as order_count,
        SUM(o.sum) as total_revenue,
        MAX(o.dato) as last_order_date
      FROM kunde k
      INNER JOIN ordre o ON k.kundenr = o.kundenr
      ${dateFilter ? 'WHERE 1=1' : ''}
      ${dateFilter}
      GROUP BY k.kundenr, k.kundenavn
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT $${params.length}
    `;
    const result = await query(sql, params);
    return result.rows;
  },
};
