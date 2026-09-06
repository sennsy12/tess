import pool from '../../db/pool.js';
import { dbLogger } from '../../lib/logger.js';
import type { SqlParams } from '../../db/query.js';
import { SampleLine } from './helpers.js';

/**
 * Per-query server-side timeout for the simulator sample scan (ms).
 * Simulator queries are admin-triggered analytics over large fact tables;
 * the guard keeps one bad date range from pinning a pool connection.
 * Override with SIMULATOR_STATEMENT_TIMEOUT_MS. Applied on a dedicated
 * client and always reset before release, so pooled sessions are unaffected.
 */
function simulatorStatementTimeoutMs(): number {
  const raw = Number(process.env.SIMULATOR_STATEMENT_TIMEOUT_MS ?? 15000);
  if (!Number.isFinite(raw)) return 15000;
  return Math.max(1000, Math.floor(raw));
}

/** Hard cap mirrors the service cap so direct callers are bounded too. */
const SAMPLE_HARD_CAP = 5000;

/**
 * Fetch a sample of order lines with customer and product metadata.
 * Uses recent orders first (most relevant for impact analysis).
 *
 * NOTE (N+1 shape): the per-line `current_rule_id` lookup below is a
 * correlated subquery (LIMIT 1 per sample row). The planned optimisation is
 * `LEFT JOIN LATERAL (...) ON true`, which is semantically identical (one
 * output row per sample line, NULL when no rule matches) and lets the
 * planner use a nested-loop + index scan instead of re-planning per row.
 * The rewrite is DELIBERATELY deferred: without a live DB in this
 * environment (no TEST_DATABASE_URL) result-equivalence cannot be proven by
 * execution, and the correlated form is correct. The statement-timeout guard
 * added here bounds the worst case instead. Default sample size (1000) and
 * cap (5000) are intentionally unchanged (UX contract).
 */
export async function fetchSampleLines(
  startDate?: string,
  endDate?: string,
  limit: number = 1000,
): Promise<SampleLine[]> {
  // Early return: nothing to sample (avoids a wasted full-plan query).
  if (!Number.isFinite(limit) || limit <= 0) {
    return [];
  }
  const safeLimit = Math.min(Math.floor(limit), SAMPLE_HARD_CAP);

  const conditions: string[] = [];
  const params: SqlParams = [];
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

  params.push(safeLimit);

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

  const client = await pool.connect();
  try {
    await client.query(`SET statement_timeout = ${simulatorStatementTimeoutMs()}`);
    const result = await client.query(sql, params);
    return result.rows;
  } catch (err) {
    dbLogger.warn({ err }, 'fetchSampleLines failed');
    throw err;
  } finally {
    try {
      await client.query('SET statement_timeout = 0');
    } catch {
      // Reset is best-effort; a broken connection is discarded by the pool.
    }
    client.release();
  }
}
