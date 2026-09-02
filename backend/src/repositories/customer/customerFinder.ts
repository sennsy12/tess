/**
 * Customer read queries: list + single lookup.
 *
 * `findAllPaginated` is the senior-standard path (window-count, clamped).
 * Plain `findAll` is kept for backward compatibility (admin dropdowns).
 *
 * @module repositories/customer/customerFinder
 */
import { query } from '../../db/index.js';
import { extractWindowCountPage } from '../../lib/paginatedQuery.js';

const CUSTOMER_LIST_SELECT = 'SELECT kundenr, kundenavn, customer_group_id FROM kunde';

export async function findAllCustomers(): Promise<Array<Record<string, any>>> {
  const result = await query('SELECT * FROM kunde ORDER BY kundenavn');
  return result.rows;
}

export async function findCustomersPaginated(options?: {
  page?: number;
  limit?: number;
}): Promise<{
  data: Array<Record<string, any>>;
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Math.floor(options?.page ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Math.floor(options?.limit ?? 50) || 50));
  const offset = (page - 1) * limit;
  const result = await query(
    `SELECT ${CUSTOMER_LIST_SELECT.replace('SELECT ', '')},
            COUNT(*) OVER()::int AS _total_count
     FROM kunde ORDER BY kundenavn LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  const { data, total } = extractWindowCountPage(result.rows);
  return { data, total, page, limit };
}

export async function findCustomerByNumber(
  kundenr: string,
): Promise<Record<string, any> | undefined> {
  const result = await query('SELECT * FROM kunde WHERE kundenr = $1', [kundenr]);
  return result.rows[0];
}

