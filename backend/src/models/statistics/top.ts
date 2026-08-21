import { query } from '../../db/index.js';

export const topStatsModel = {
  /**
   * Get top N products by revenue
   */
  getTopProducts: async (limit: number = 10) => {
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
      GROUP BY v.varekode, v.varenavn, v.varegruppe
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    return result.rows;
  },

  /**
   * Get top N customers by revenue
   */
  getTopCustomers: async (limit: number = 10) => {
    const sql = `
      SELECT 
        k.kundenr,
        k.kundenavn,
        COUNT(DISTINCT o.ordrenr) as order_count,
        SUM(o.sum) as total_revenue,
        MAX(o.dato) as last_order_date
      FROM kunde k
      INNER JOIN ordre o ON k.kundenr = o.kundenr
      GROUP BY k.kundenr, k.kundenavn
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT $1
    `;
    const result = await query(sql, [limit]);
    return result.rows;
  }
};
