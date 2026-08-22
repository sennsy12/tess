/**
 * Customer Model
 *
 * Read-only data-access for the `kunde` table and portal profile aggregates.
 *
 * @module models/customerModel
 */
import { query } from '../db/index.js';
import { SQL_ACTIVE_ORDER_WHERE } from '../lib/orderWorkflow.js';

/** Raw row from the single profile query (before service-layer mapping). */
export interface CustomerProfileDbRow {
  kundenr: string;
  kundenavn: string | null;
  customer_group_id: number | null;
  customer_group_name: string | null;
  customer_group_description: string | null;
  portal_username: string | null;
  account_created_at: string | null;
  primary_firma: string | null;
  primary_lager: string | null;
  contact_refs_json: unknown;
  order_count: number;
  total_revenue: number;
  active_orders: number;
  first_order_date: string | null;
  last_order_date: string | null;
}

const PROFILE_SQL = `
  WITH order_stats AS (
    SELECT
      COUNT(*)::int AS order_count,
      COALESCE(SUM(sum), 0) AS total_revenue,
      COUNT(*) FILTER (WHERE ${SQL_ACTIVE_ORDER_WHERE})::int AS active_orders,
      MIN(dato)::text AS first_order_date,
      MAX(dato)::text AS last_order_date
    FROM ordre
    WHERE kundenr = $1
  ),
  contact_refs AS (
    SELECT COALESCE(
      json_agg(kunderef ORDER BY last_used DESC),
      '[]'::json
    ) AS refs
    FROM (
      SELECT kunderef, MAX(dato) AS last_used
      FROM ordre
      WHERE kundenr = $1
        AND kunderef IS NOT NULL
        AND TRIM(kunderef) <> ''
      GROUP BY kunderef
      ORDER BY last_used DESC
      LIMIT 6
    ) recent_refs
  )
  SELECT
    k.kundenr,
    k.kundenavn,
    cg.id AS customer_group_id,
    cg.name AS customer_group_name,
    cg.description AS customer_group_description,
    portal.username AS portal_username,
    portal.created_at AS account_created_at,
    (
      SELECT f.firmanavn
      FROM ordre o
      INNER JOIN firma f ON o.firmaid = f.firmaid
      WHERE o.kundenr = k.kundenr
      GROUP BY f.firmanavn
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS primary_firma,
    (
      SELECT o.lagernavn
      FROM ordre o
      WHERE o.kundenr = k.kundenr AND o.lagernavn IS NOT NULL
      GROUP BY o.lagernavn
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS primary_lager,
    cr.refs AS contact_refs_json,
    os.order_count,
    os.total_revenue,
    os.active_orders,
    os.first_order_date,
    os.last_order_date
  FROM kunde k
  LEFT JOIN customer_group cg ON k.customer_group_id = cg.id
  LEFT JOIN LATERAL (
    SELECT u.username, u.created_at
    FROM users u
    WHERE u.kundenr = k.kundenr AND u.role = 'kunde'
    ORDER BY u.created_at ASC NULLS LAST, u.id ASC
    LIMIT 1
  ) portal ON true
  CROSS JOIN order_stats os
  CROSS JOIN contact_refs cr
  WHERE k.kundenr = $1
`;

export const customerModel = {
  findAll: async () => {
    const result = await query('SELECT * FROM kunde ORDER BY kundenavn');
    return result.rows;
  },

  findByNumber: async (kundenr: string) => {
    const result = await query('SELECT * FROM kunde WHERE kundenr = $1', [kundenr]);
    return result.rows[0];
  },

  /**
   * Single round-trip profile query: company, group, portal user, order stats, partners, contacts.
   */
  findProfileByNumber: async (kundenr: string): Promise<CustomerProfileDbRow | null> => {
    const result = await query(PROFILE_SQL, [kundenr]);
    return (result.rows[0] as CustomerProfileDbRow | undefined) ?? null;
  },
};
