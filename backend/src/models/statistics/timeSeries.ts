import { query } from '../../db/index.js';
import type { StatsFilters } from './types.js';

export const timeSeriesStatsModel = {
  getTimeSeries: async (
    filters: StatsFilters,
    user?: { role: string; kundenr?: string }
  ) => {
    const groupBy = filters.groupBy || 'month';
    let dateFormat = "TO_CHAR(o.dato, 'YYYY-MM')";
    if (groupBy === 'day') {
      dateFormat = "TO_CHAR(o.dato, 'YYYY-MM-DD')";
    } else if (groupBy === 'week') {
      dateFormat = "TO_CHAR(DATE_TRUNC('week', o.dato), 'YYYY-MM-DD')";
    } else if (groupBy === 'year') {
      dateFormat = "TO_CHAR(o.dato, 'YYYY')";
    }
    
    let sql = `
      SELECT ${dateFormat} as period,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM ordre o
      WHERE o.dato IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by customer when the logged-in user is a kunde
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    } else if (filters.kundenr) {
      sql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    sql += ` GROUP BY ${dateFormat} ORDER BY period`;

    const result = await query(sql, params);
    return result.rows;
  },

  getSummary: async (
    filters: StatsFilters,
    user?: { role: string; kundenr?: string }
  ) => {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by customer when the logged-in user is a kunde
    if (user?.role === 'kunde' && user?.kundenr) {
      dateFilter += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    } else if (filters.kundenr) {
      dateFilter += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    if (filters.startDate) {
      dateFilter += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      dateFilter += ` AND o.dato <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    const [ordersResult, customersResult, productsResult, topCustomerResult] = await Promise.all([
      query(`SELECT COUNT(*) as count, SUM(sum) as total FROM ordre o WHERE 1=1 ${dateFilter}`, params),
      query(`SELECT COUNT(DISTINCT kundenr) as count FROM ordre o WHERE 1=1 ${dateFilter}`, params),
      query(`SELECT COUNT(DISTINCT varekode) as count FROM ordrelinje ol INNER JOIN ordre o ON ol.ordrenr = o.ordrenr WHERE 1=1 ${dateFilter}`, params),
      query(`
        SELECT k.kundenavn, SUM(o.sum) as total 
        FROM ordre o 
        JOIN kunde k ON o.kundenr = k.kundenr 
        WHERE 1=1 ${dateFilter}
        GROUP BY k.kundenr, k.kundenavn 
        ORDER BY total DESC LIMIT 1
      `, params),
    ]);

    return {
      totalOrders: parseInt(ordersResult.rows[0]?.count || '0'),
      totalRevenue: parseFloat(ordersResult.rows[0]?.total || '0'),
      activeCustomers: parseInt(customersResult.rows[0]?.count || '0'),
      productsOrdered: parseInt(productsResult.rows[0]?.count || '0'),
      topCustomer: topCustomerResult.rows[0] || null,
    };
  },
};
