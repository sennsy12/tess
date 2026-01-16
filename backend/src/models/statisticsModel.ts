import { query } from '../db/index.js';

export interface StatsFilters {
  startDate?: string;
  endDate?: string;
  varegruppe?: string;
  groupBy?: string;
}

export const statisticsModel = {
  getByKunde: async (filters: StatsFilters) => {
    let sql = `
      SELECT k.kundenr, k.kundenavn, 
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum,
             AVG(o.sum) as avg_order_value
      FROM kunde k
      LEFT JOIN ordre o ON k.kundenr = o.kundenr
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ' GROUP BY k.kundenr, k.kundenavn ORDER BY total_sum DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  },

  getByVaregruppe: async (filters: StatsFilters) => {
    let sql = `
      SELECT v.varegruppe,
             COUNT(DISTINCT ol.ordrenr) as order_count,
             SUM(ol.antall) as total_quantity,
             SUM(ol.linjesum) as total_sum
      FROM vare v
      LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
      LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
      WHERE v.varegruppe IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ' GROUP BY v.varegruppe ORDER BY total_sum DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  },

  getByVare: async (filters: StatsFilters) => {
    let sql = `
      SELECT v.varekode, v.varenavn, v.varegruppe,
             COUNT(DISTINCT ol.ordrenr) as order_count,
             SUM(ol.antall) as total_quantity,
             SUM(ol.linjesum) as total_sum
      FROM vare v
      LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
      LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.varegruppe) {
      sql += ` AND v.varegruppe = $${paramIndex++}`;
      params.push(filters.varegruppe);
    }

    sql += ' GROUP BY v.varekode, v.varenavn, v.varegruppe ORDER BY total_sum DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  },

  getByLager: async (filters: StatsFilters) => {
    let sql = `
      SELECT l.lagernavn, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM lager l
      LEFT JOIN firma f ON l.firmaid = f.firmaid
      LEFT JOIN ordre o ON l.lagernavn = o.lagernavn AND l.firmaid = o.firmaid
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ' GROUP BY l.lagernavn, l.firmaid, f.firmanavn ORDER BY total_sum DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  },

  getByFirma: async (filters: StatsFilters) => {
    let sql = `
      SELECT f.firmaid, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM firma f
      LEFT JOIN ordre o ON f.firmaid = o.firmaid
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ' GROUP BY f.firmaid, f.firmanavn ORDER BY total_sum DESC NULLS LAST';

    const result = await query(sql, params);
    return result.rows;
  },

  getTimeSeries: async (filters: StatsFilters) => {
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

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ` GROUP BY ${dateFormat} ORDER BY period`;

    const result = await query(sql, params);
    return result.rows;
  },

  getSummary: async (filters: StatsFilters) => {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      dateFilter += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      dateFilter += ` AND o.dato <= $${paramIndex++}`;
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
  getCustomStats: async (
    filters: StatsFilters & { 
      metric: 'sum' | 'count' | 'quantity';
      dimension: 'day' | 'month' | 'year' | 'product' | 'category';
    },
    user?: { role: string; kundenr?: string }
  ) => {
    let selectClause = '';
    let groupByClause = '';
    let orderByClause = '';
    let joinClause = '';
    
    // 1. Determine Dimension (Group By)
    switch (filters.dimension) {
      case 'day':
        selectClause = "TO_CHAR(o.dato, 'YYYY-MM-DD') as label";
        groupByClause = "TO_CHAR(o.dato, 'YYYY-MM-DD')";
        orderByClause = "label ASC";
        break;
      case 'month':
        selectClause = "TO_CHAR(o.dato, 'YYYY-MM') as label";
        groupByClause = "TO_CHAR(o.dato, 'YYYY-MM')";
        orderByClause = "label ASC";
        break;
      case 'year':
        selectClause = "TO_CHAR(o.dato, 'YYYY') as label";
        groupByClause = "TO_CHAR(o.dato, 'YYYY')";
        orderByClause = "label ASC";
        break;
      case 'product':
        selectClause = "v.varenavn as label";
        groupByClause = "v.varenavn";
        orderByClause = "value DESC";
        joinClause += " JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr JOIN vare v ON ol.varekode = v.varekode";
        break;
      case 'category':
        selectClause = "v.varegruppe as label";
        groupByClause = "v.varegruppe";
        orderByClause = "value DESC";
        joinClause += " JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr JOIN vare v ON ol.varekode = v.varekode";
        break;
      default:
        throw new Error('Invalid dimension');
    }

    // 2. Determine Metric (Value)
    let metricClause = '';
    switch (filters.metric) {
      case 'sum':
        // If grouping by product/category, we need line sums. Otherwise order sums.
        if (filters.dimension === 'product' || filters.dimension === 'category') {
          metricClause = "SUM(ol.linjesum) as value";
        } else {
          metricClause = "SUM(o.sum) as value";
        }
        break;
      case 'count':
        metricClause = "COUNT(DISTINCT o.ordrenr) as value";
        break;
      case 'quantity':
        if (filters.dimension === 'product' || filters.dimension === 'category') {
           metricClause = "SUM(ol.antall) as value";
        } else {
           // Fallback if they ask for quantity over time without joining lines (expensive)
           // We'll join lines implicitly if needed
           if (!joinClause.includes('ordrelinje')) {
             joinClause += " JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr";
           }
           metricClause = "SUM(ol.antall) as value";
        }
        break;
      default:
        throw new Error('Invalid metric');
    }

    let sql = `
      SELECT ${selectClause}, ${metricClause}
      FROM ordre o
      ${joinClause}
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // 3. Apply Filters
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    }

    if (filters.startDate) {
      sql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    sql += ` GROUP BY ${groupByClause} ORDER BY ${orderByClause} LIMIT 50`;

    const result = await query(sql, params);
    return result.rows;
  }
};
