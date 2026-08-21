import type { StatsFilters, PaginatedResult } from './types.js';
import {
  getPagination,
  runPaginatedGroupQuery,
  runMaterializedViewQuery,
  hasDateOrKundeFilter,
} from './pagination.js';

export const groupedStatsModel = {
  getByKunde: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    if (!hasDateOrKundeFilter(filters)) {
      return runMaterializedViewQuery('mv_stats_by_kunde', 'total_sum DESC NULLS LAST', page, limit, offset);
    }

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

    const aggregatedSql = `
      SELECT k.kundenr, k.kundenavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum,
             AVG(o.sum) as avg_order_value
      FROM kunde k
      LEFT JOIN ordre o ON k.kundenr = o.kundenr
      ${whereClause}
      GROUP BY k.kundenr, k.kundenavn
      HAVING SUM(o.sum) > 0
    `;

    return runPaginatedGroupQuery(
      aggregatedSql,
      params,
      'total_sum DESC NULLS LAST',
      page,
      limit,
      offset,
      paramIndex,
    );
  },

  getByVaregruppe: async (filters: StatsFilters): Promise<PaginatedResult<any>> => {
    const { page, limit, offset } = getPagination(filters);

    if (!hasDateOrKundeFilter(filters) && !filters.varegruppe) {
      return runMaterializedViewQuery('mv_stats_by_varegruppe', 'total_sum DESC NULLS LAST', page, limit, offset);
    }

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

    const aggregatedSql = `
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
    `;

    return runPaginatedGroupQuery(
      aggregatedSql,
      params,
      'total_sum DESC NULLS LAST',
      page,
      limit,
      offset,
      paramIndex,
    );
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

    const aggregatedSql = `
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
    `;

    return runPaginatedGroupQuery(
      aggregatedSql,
      params,
      'total_sum DESC NULLS LAST',
      page,
      limit,
      offset,
      paramIndex,
    );
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

    const aggregatedSql = `
      SELECT l.lagernavn, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM lager l
      LEFT JOIN firma f ON l.firmaid = f.firmaid
      LEFT JOIN ordre o ON l.lagernavn = o.lagernavn AND l.firmaid = o.firmaid
      ${whereClause}
      GROUP BY l.lagernavn, l.firmaid, f.firmanavn
      HAVING SUM(o.sum) > 0
    `;

    return runPaginatedGroupQuery(
      aggregatedSql,
      params,
      'total_sum DESC NULLS LAST',
      page,
      limit,
      offset,
      paramIndex,
    );
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

    const aggregatedSql = `
      SELECT f.firmaid, f.firmanavn,
             COUNT(DISTINCT o.ordrenr) as order_count,
             SUM(o.sum) as total_sum
      FROM firma f
      LEFT JOIN ordre o ON f.firmaid = o.firmaid
      ${whereClause}
      GROUP BY f.firmaid, f.firmanavn
      HAVING SUM(o.sum) > 0
    `;

    return runPaginatedGroupQuery(
      aggregatedSql,
      params,
      'total_sum DESC NULLS LAST',
      page,
      limit,
      offset,
      paramIndex,
    );
  },
};
