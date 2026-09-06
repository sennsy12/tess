import { query } from '../../db/index.js';
import { toIlikeContains } from '../../lib/sqlSearch.js';
import type { StatsFilters } from './types.js';

/** Default row cap for custom stats (historic behaviour); hard max 200. */
const CUSTOM_STATS_DEFAULT_LIMIT = 50;
const CUSTOM_STATS_MAX_LIMIT = 200;

// MV OPPORTUNITY: product/category dimensions over full history aggregate
// `ordrelinje` per request. If slow, pre-aggregate per (varegruppe, month)
// and per (varekode, month) MVs (same hourly refresh as the 005 MVs) and
// serve day/month/year rollups from them. Semantics below are unchanged.

export const customStatsModel = {
  getCustomStats: async (
    filters: StatsFilters & { 
      metric: 'sum' | 'count' | 'quantity';
      dimension: 'day' | 'month' | 'year' | 'product' | 'category';
    },
    user?: { role: string; kundenr?: string }
  ) => {
    let selectClause: string;
    let groupByClause: string;
    let orderByClause: string;
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
    let metricClause: string;
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
    } else if (filters.search) {
      // Free-text search: match kundenr OR any henvisning1-5
      const searchPattern = toIlikeContains(filters.search);
      sql += ` AND (
        o.kundenr::text ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM ordre_henvisning oh
          WHERE oh.ordrenr = o.ordrenr AND (
            oh.henvisning1 ILIKE $${paramIndex} OR
            oh.henvisning2 ILIKE $${paramIndex} OR
            oh.henvisning3 ILIKE $${paramIndex} OR
            oh.henvisning4 ILIKE $${paramIndex} OR
            oh.henvisning5 ILIKE $${paramIndex}
          )
        )
      )`;
      params.push(searchPattern);
      paramIndex++;
    } else if (filters.kundenr) {
      // Exact kundenr match (legacy / direct filter)
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

    // filters.limit is honoured when present; default 50 preserves the
    // historic hard LIMIT, hard-capped at 200 to block runaway scans.
    const requestedLimit = Number.isFinite(filters.limit) ? Math.floor(filters.limit as number) : CUSTOM_STATS_DEFAULT_LIMIT;
    const safeLimit = Math.min(
      Math.max(1, requestedLimit || CUSTOM_STATS_DEFAULT_LIMIT),
      CUSTOM_STATS_MAX_LIMIT,
    );

    sql += ` GROUP BY ${groupByClause} ORDER BY ${orderByClause} LIMIT ${safeLimit}`;

    const result = await query(sql, params);
    return result.rows;
  },
};
