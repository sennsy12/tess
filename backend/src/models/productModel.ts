import { query } from '../db/index.js';
import { extractWindowCountPage } from '../lib/paginatedQuery.js';
import { buildOrderByClause } from '../lib/sqlSort.js';
import { toIlikeContains } from '../lib/sqlSearch.js';

export interface ProductSearchParams {
  search?: string;
  varegruppe?: string;
  page: number;
  limit: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const PRODUCT_SORT_COLUMNS: Record<string, string> = {
  varekode: 'v.varekode',
  varenavn: 'v.varenavn',
  varegruppe: 'v.varegruppe',
};

export const productModel = {
  searchProducts: async (params: ProductSearchParams): Promise<{ data: any[]; total: number }> => {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (params.search?.trim()) {
      conditions.push(`(v.varekode ILIKE $${paramIdx} OR v.varenavn ILIKE $${paramIdx})`);
      values.push(toIlikeContains(params.search));
      paramIdx++;
    }

    if (params.varegruppe === '__none__') {
      conditions.push('v.varegruppe IS NULL');
    } else if (params.varegruppe) {
      conditions.push(`v.varegruppe = $${paramIdx}`);
      values.push(params.varegruppe);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = buildOrderByClause(
      PRODUCT_SORT_COLUMNS,
      params.sortBy,
      params.sortDir,
      'v.varenavn',
    );
    const offset = (params.page - 1) * params.limit;

    const dataResult = await query(
      `SELECT v.varekode, v.varenavn, v.varegruppe,
              COUNT(*) OVER()::int AS _total_count
       FROM vare v
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, params.limit, offset],
    );

    const { data, total } = extractWindowCountPage(dataResult.rows);

    return { data, total };
  },

  findGroups: async () => {
    const result = await query(
      'SELECT DISTINCT varegruppe FROM vare WHERE varegruppe IS NOT NULL ORDER BY varegruppe',
    );
    return result.rows.map((r) => r.varegruppe);
  },

  findByCode: async (varekode: string) => {
    const result = await query('SELECT * FROM vare WHERE varekode = $1', [varekode]);
    return result.rows[0];
  },
};
