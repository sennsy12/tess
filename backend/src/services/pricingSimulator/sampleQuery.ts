import { query } from '../../db/index.js';
import { SampleLine } from './helpers.js';

/**
 * Fetch a sample of order lines with customer and product metadata.
 * Uses recent orders first (most relevant for impact analysis).
 */
export async function fetchSampleLines(
  startDate?: string,
  endDate?: string,
  limit: number = 1000,
): Promise<SampleLine[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (startDate) {
    conditions.push(`o.dato >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`o.dato <= $${idx++}`);
    params.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);

  // We use a subquery to get the applicable rule for each line
  // This mirrors the logic in pricingService.calculatePrice
  const sql = `
    WITH sample_lines AS (
      SELECT
        ol.ordrenr,
        ol.linjenr,
        ol.varekode,
        v.varegruppe,
        o.kundenr,
        k.kundenavn,
        ol.antall,
        ol.nettpris,
        ol.linjesum,
        k.customer_group_id,
        o.dato
      FROM ordrelinje ol
      JOIN ordre o ON ol.ordrenr = o.ordrenr
      JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN vare v ON ol.varekode = v.varekode
      ${where}
      ORDER BY o.dato DESC
      LIMIT $${idx}
    )
    SELECT 
      sl.*,
      -- Find the best applicable rule for each line to determine 'actual' current pricing
      (
        SELECT pr.id
        FROM price_rule pr
        INNER JOIN price_list pl ON pr.price_list_id = pl.id
        WHERE pl.is_active = TRUE
          AND (pl.valid_from IS NULL OR pl.valid_from <= sl.dato)
          AND (pl.valid_to IS NULL OR pl.valid_to >= sl.dato)
          AND pr.min_quantity <= sl.antall
          AND (pr.varekode = sl.varekode OR pr.varegruppe = sl.varegruppe OR (pr.varekode IS NULL AND pr.varegruppe IS NULL))
          AND (pr.kundenr = sl.kundenr OR pr.customer_group_id = sl.customer_group_id OR (pr.kundenr IS NULL AND pr.customer_group_id IS NULL))
        ORDER BY 
          pl.priority DESC,
          CASE WHEN pr.varekode IS NOT NULL THEN 0 WHEN pr.varegruppe IS NOT NULL THEN 1 ELSE 2 END,
          CASE WHEN pr.kundenr IS NOT NULL THEN 0 WHEN pr.customer_group_id IS NOT NULL THEN 1 ELSE 2 END,
          pr.min_quantity DESC
        LIMIT 1
      ) as current_rule_id
    FROM sample_lines sl
  `;

  const result = await query(sql, params);
  return result.rows;
}
