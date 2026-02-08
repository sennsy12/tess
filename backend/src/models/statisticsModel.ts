/**
 * Statistics Model
 *
 * Provides aggregated analytics queries over the `ordre` / `ordrelinje`
 * tables, grouped by various dimensions (customer, product, warehouse,
 * company, time). Each method supports date-range filtering, optional
 * customer/category scoping, and server-side pagination.
 *
 * @module models/statisticsModel
 */
import { query } from '../db/index.js';

/** Common filter parameters shared across all statistics queries. */
export interface StatsFilters {
  startDate?: string;
  endDate?: string;
  varegruppe?: string;
  kundenr?: string;
  groupBy?: string;
  page?: number;
  limit?: number;
}

/** Standard paginated response envelope used by all statistics endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Extract and normalise pagination params from a filters object. */
const getPagination = (filters: StatsFilters) => {
  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/** Build the pagination metadata envelope. */
const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const statisticsModel = {
  getByKunde: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.kundenr) {
      whereClause += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT k.kundenr
        FROM kunde k
        LEFT JOIN ordre o ON k.kundenr = o.kundenr
        ${whereClause}
        GROUP BY k.kundenr
        HAVING SUM(o.sum) > 0
      ) subquery
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query with pagination
    const dataSql = `
      SELECT k.kundenr, k.kundenavn, 
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum,
             AVG(o.sum) as avg_order_value
      FROM kunde k
      LEFT JOIN ordre o ON k.kundenr = o.kundenr
      ${whereClause}
      GROUP BY k.kundenr, k.kundenavn
      HAVING SUM(o.sum) > 0
      ORDER BY total_sum DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: buildPagination(page, limit, total),
    };
  },

  getByVaregruppe: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    let whereClause = ' WHERE v.varegruppe IS NOT NULL';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.kundenr) {
      whereClause += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }
    if (filters.varegruppe) {
      whereClause += ` AND v.varegruppe = $${paramIndex++}`;
      params.push(filters.varegruppe);
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT v.varegruppe
        FROM vare v
        LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
        LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
        ${whereClause}
        GROUP BY v.varegruppe
        HAVING SUM(ol.linjesum) > 0
      ) subquery
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query with pagination
    const dataSql = `
      SELECT v.varegruppe,
             COUNT(DISTINCT ol.ordrenr) as order_count,
             SUM(ol.antall) as total_quantity,
             SUM(ol.linjesum) as total_sum
      FROM vare v
      LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
      LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
      ${whereClause}
      GROUP BY v.varegruppe
      HAVING SUM(ol.linjesum) > 0
      ORDER BY total_sum DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: buildPagination(page, limit, total),
    };
  },

  getByVare: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.varegruppe) {
      whereClause += ` AND v.varegruppe = $${paramIndex++}`;
      params.push(filters.varegruppe);
    }
    if (filters.kundenr) {
      whereClause += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT v.varekode
        FROM vare v
        LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
        LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
        ${whereClause}
        GROUP BY v.varekode
        HAVING SUM(ol.linjesum) > 0
      ) subquery
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query with pagination
    const dataSql = `
      SELECT v.varekode, v.varenavn, v.varegruppe,
             COUNT(DISTINCT ol.ordrenr) as order_count,
             SUM(ol.antall) as total_quantity,
             SUM(ol.linjesum) as total_sum
      FROM vare v
      LEFT JOIN ordrelinje ol ON v.varekode = ol.varekode
      LEFT JOIN ordre o ON ol.ordrenr = o.ordrenr
      ${whereClause}
      GROUP BY v.varekode, v.varenavn, v.varegruppe
      HAVING SUM(ol.linjesum) > 0
      ORDER BY total_sum DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: buildPagination(page, limit, total),
    };
  },

  getByLager: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.kundenr) {
      whereClause += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT l.lagernavn, l.firmaid
        FROM lager l
        LEFT JOIN firma f ON l.firmaid = f.firmaid
        LEFT JOIN ordre o ON l.lagernavn = o.lagernavn AND l.firmaid = o.firmaid
        ${whereClause}
        GROUP BY l.lagernavn, l.firmaid
        HAVING SUM(o.sum) > 0
      ) subquery
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query with pagination
    const dataSql = `
      SELECT l.lagernavn, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM lager l
      LEFT JOIN firma f ON l.firmaid = f.firmaid
      LEFT JOIN ordre o ON l.lagernavn = o.lagernavn AND l.firmaid = o.firmaid
      ${whereClause}
      GROUP BY l.lagernavn, l.firmaid, f.firmanavn
      HAVING SUM(o.sum) > 0
      ORDER BY total_sum DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: buildPagination(page, limit, total),
    };
  },

  getByFirma: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      whereClause += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClause += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }
    if (filters.kundenr) {
      whereClause += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT f.firmaid
        FROM firma f
        LEFT JOIN ordre o ON f.firmaid = o.firmaid
        ${whereClause}
        GROUP BY f.firmaid
        HAVING SUM(o.sum) > 0
      ) subquery
    `;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    // Data query with pagination
    const dataSql = `
      SELECT f.firmaid, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM firma f
      LEFT JOIN ordre o ON f.firmaid = o.firmaid
      ${whereClause}
      GROUP BY f.firmaid, f.firmanavn
      HAVING SUM(o.sum) > 0
      ORDER BY total_sum DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    const dataResult = await query(dataSql, [...params, limit, offset]);

    return {
      data: dataResult.rows,
      pagination: buildPagination(page, limit, total),
    };
  },

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
      sql += ` AND o.dato <= $${paramIndex++}`;
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
      // Force customer to only see their own data
      sql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    } else if (filters.kundenr) {
      // Allow admin/analyse to filter by specific customer if provided
      sql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
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
  },

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

