import { query } from '../../db/index.js';
import { extractWindowCountPage } from '../../lib/paginatedQuery.js';
import type { StatsFilters, PaginatedResult } from './types.js';

/** Extract and normalise pagination params from a filters object. */
export const getPagination = (filters: StatsFilters) => {
  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/** Build the pagination metadata envelope. */
export const buildPagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/** Single-query paginated grouped stats using COUNT(*) OVER(). */
export const runPaginatedGroupQuery = async (
  aggregatedSql: string,
  params: any[],
  orderBy: string,
  page: number,
  limit: number,
  offset: number,
  paramIndex: number,
): Promise<PaginatedResult<any>> => {
  const sql = `
    WITH aggregated AS (${aggregatedSql})
    SELECT sub.*, COUNT(*) OVER()::int AS _total_count
    FROM aggregated sub
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataResult = await query(sql, [...params, limit, offset]);
  const { data, total } = extractWindowCountPage(dataResult.rows);
  return { data, pagination: buildPagination(page, limit, total) };
};

/** Fast path: paginate a materialized view when no date/customer filters apply. */
export const runMaterializedViewQuery = async (
  viewName: string,
  orderBy: string,
  page: number,
  limit: number,
  offset: number,
): Promise<PaginatedResult<any>> => {
  const sql = `
    SELECT sub.*, COUNT(*) OVER()::int AS _total_count
    FROM ${viewName} sub
    ORDER BY ${orderBy}
    LIMIT $1 OFFSET $2
  `;
  const dataResult = await query(sql, [limit, offset]);
  const { data, total } = extractWindowCountPage(dataResult.rows);
  return { data, pagination: buildPagination(page, limit, total) };
};

export const hasDateOrKundeFilter = (filters: StatsFilters) =>
  Boolean(filters.startDate || filters.endDate || filters.kundenr);
