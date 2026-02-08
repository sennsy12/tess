/**
 * Pricing Simulator Service
 *
 * Implements the "What-If" analysis engine. Given a proposed pricing
 * rule change, the service:
 *   1. Fetches a sample of recent order lines with their base prices
 *   2. Calculates current revenue using the live pricing rules
 *   3. Temporarily overlays the proposed rule and recalculates
 *   4. Returns a detailed before/after comparison
 *
 * The simulation is **read-only** — no data is modified.
 *
 * @module services/pricingSimulatorService
 */

import { query } from '../db/index.js';
import { pricingService } from './pricingService.js';
import type {
  SimulationRequest,
  SimulationResult,
  ProposedRule,
  RevenueBucket,
  CustomerImpact,
  ProductImpact,
  TrendPoint,
} from '../types/simulation.js';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Raw order-line row returned by the sample query. */
interface SampleLine {
  ordrenr: number;
  linjenr: number;
  varekode: string;
  varegruppe: string | null;
  kundenr: string;
  kundenavn: string;
  antall: number;
  nettpris: number;
  linjesum: number;
  customer_group_id: number | null;
  current_rule_id: number | null;
  dato: string | Date;
}

/**
 * Determine whether a proposed rule would match a given order line.
 * Mirrors the matching logic in `priceRuleModel.findApplicable`.
 */
function ruleMatchesLine(rule: ProposedRule, line: SampleLine): boolean {
  // If the proposed rule is an update to an existing rule, 
  // we check if THIS specific line was affected by that rule.
  // If it's a new rule, we check if it matches the line.
  
  // Product match
  const productMatch =
    (!rule.varekode && !rule.varegruppe) ||  // wildcard
    rule.varekode === line.varekode ||
    rule.varegruppe === line.varegruppe;

  // Customer match
  const customerMatch =
    (!rule.kundenr && !rule.customer_group_id) || // wildcard
    rule.kundenr === line.kundenr ||
    (rule.customer_group_id != null && rule.customer_group_id === line.customer_group_id);

  // Quantity match
  const qtyMatch = line.antall >= (rule.min_quantity ?? 0);

  return productMatch && customerMatch && qtyMatch;
}

/**
 * Apply a proposed rule to a unit price and return the simulated line total.
 */
function applyProposedRule(
  rule: ProposedRule,
  unitPrice: number,
  quantity: number,
): number {
  if (rule.fixed_price != null) {
    return Math.round(Number(rule.fixed_price) * quantity * 100) / 100;
  }
  if (rule.discount_percent != null) {
    const multiplier = 1 - Number(rule.discount_percent) / 100;
    return Math.round(unitPrice * multiplier * quantity * 100) / 100;
  }
  // No discount → unchanged
  return Math.round(unitPrice * quantity * 100) / 100;
}

/** Compute percentage change, safe against division by zero. */
function pctChange(current: number, simulated: number): number {
  if (current === 0) return simulated === 0 ? 0 : 100;
  return Math.round(((simulated - current) / Math.abs(current)) * 10000) / 100;
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export const pricingSimulatorService = {
  /**
   * Run a full simulation of a proposed rule change against historical
   * order data and return the before/after revenue comparison.
   */
  simulate: async (request: SimulationRequest): Promise<SimulationResult> => {
    const start = Date.now();
    const { proposed_rule, start_date, end_date } = request;
    const sampleSize = Math.min(request.sample_size ?? 1000, 5000);

    // ── 1. Fetch sample order lines ────────────────────────
    const lines = await fetchSampleLines(start_date, end_date, sampleSize);

    if (lines.length === 0) {
      return emptyResult(Date.now() - start);
    }

    // ── 2. Calculate current & simulated totals ────────────
    const currentBucket = createBucket();
    const simulatedBucket = createBucket();

    // Accumulators for per-customer, per-product, and per-date breakdowns
    const customerMap = new Map<string, { kundenavn: string; current: number; simulated: number }>();
    const productMap = new Map<string, { varenavn: string; current: number; simulated: number }>();
    const trendMap = new Map<string, { current: number; simulated: number }>();
    const orderSet = new Set<number>();

    for (const line of lines) {
      const currentLineTotal = Number(line.linjesum);
      orderSet.add(line.ordrenr);

      // Current side
      currentBucket.total_revenue += currentLineTotal;
      currentBucket.affected_lines++;

      // Simulated side: check if the proposed rule matches this line
      let simulatedLineTotal = currentLineTotal;

      // Logic: 
      // 1. If the proposed rule matches this line, it might change the price.
      // 2. However, we only care if the proposed rule is BETTER (or different) than what was applied.
      // 3. For the simulator, we assume the proposed rule "wins" if it matches, to show the impact
      //    of that specific rule change.
      
      if (ruleMatchesLine(proposed_rule, line)) {
        simulatedLineTotal = applyProposedRule(
          proposed_rule,
          Number(line.nettpris),
          Number(line.antall),
        );
        
        // Only count as "affected" if the price actually changes from the current actual price
        if (Math.abs(simulatedLineTotal - currentLineTotal) > 0.01) {
          simulatedBucket.affected_lines++;
        }
      }

      simulatedBucket.total_revenue += simulatedLineTotal;

      // Discount deltas
      // Current discount is the difference between base price (nettpris) and what was actually paid (linjesum)
      const currentDiscount = Number(line.nettpris) * Number(line.antall) - currentLineTotal;
      const simulatedDiscount = Number(line.nettpris) * Number(line.antall) - simulatedLineTotal;
      currentBucket.total_discount += Math.max(0, currentDiscount);
      simulatedBucket.total_discount += Math.max(0, simulatedDiscount);

      // Per-customer accumulation
      const cKey = line.kundenr;
      const cEntry = customerMap.get(cKey) ?? { kundenavn: line.kundenavn, current: 0, simulated: 0 };
      cEntry.current += currentLineTotal;
      cEntry.simulated += simulatedLineTotal;
      customerMap.set(cKey, cEntry);

      // Per-product accumulation
      const pKey = line.varekode;
      const pEntry = productMap.get(pKey) ?? { varenavn: line.varekode, current: 0, simulated: 0 };
      pEntry.current += currentLineTotal;
      pEntry.simulated += simulatedLineTotal;
      productMap.set(pKey, pEntry);

      // Per-date accumulation (for trend chart)
      const dateKey = toDateKey(line.dato);
      const tEntry = trendMap.get(dateKey) ?? { current: 0, simulated: 0 };
      tEntry.current += currentLineTotal;
      tEntry.simulated += simulatedLineTotal;
      trendMap.set(dateKey, tEntry);
    }

    currentBucket.affected_orders = orderSet.size;
    simulatedBucket.affected_orders = orderSet.size;

    // Round totals
    currentBucket.total_revenue = round2(currentBucket.total_revenue);
    currentBucket.total_discount = round2(currentBucket.total_discount);
    simulatedBucket.total_revenue = round2(simulatedBucket.total_revenue);
    simulatedBucket.total_discount = round2(simulatedBucket.total_discount);

    // ── 3. Build top-movers lists ──────────────────────────
    const topCustomers = buildTopCustomers(customerMap, 10);
    const topProducts = buildTopProducts(productMap, 10);

    // ── 4. Build trend time-series ─────────────────────────
    const trend = buildTrend(trendMap);

    const revenueDiff = round2(simulatedBucket.total_revenue - currentBucket.total_revenue);

    return {
      current: currentBucket,
      simulated: simulatedBucket,
      revenue_difference: revenueDiff,
      revenue_difference_pct: pctChange(currentBucket.total_revenue, simulatedBucket.total_revenue),
      orders_analysed: orderSet.size,
      top_customers: topCustomers,
      top_products: topProducts,
      trend,
      computation_time_ms: Date.now() - start,
    };
  },
};

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function createBucket(): RevenueBucket {
  return { total_revenue: 0, total_discount: 0, affected_orders: 0, affected_lines: 0 };
}

function emptyResult(ms: number): SimulationResult {
  return {
    current: createBucket(),
    simulated: createBucket(),
    revenue_difference: 0,
    revenue_difference_pct: 0,
    orders_analysed: 0,
    top_customers: [],
    top_products: [],
    trend: [],
    computation_time_ms: ms,
  };
}

/**
 * Convert a Date or date-string into a YYYY-MM-DD key.
 */
function toDateKey(dato: string | Date): string {
  const d = dato instanceof Date ? dato : new Date(dato);
  return d.toISOString().slice(0, 10);
}

/**
 * Convert the trendMap into a sorted array of TrendPoints.
 * Automatically groups into months if the date span exceeds 60 days.
 */
function buildTrend(
  map: Map<string, { current: number; simulated: number }>,
): TrendPoint[] {
  if (map.size === 0) return [];

  const sortedKeys = Array.from(map.keys()).sort();
  const firstDate = new Date(sortedKeys[0]);
  const lastDate = new Date(sortedKeys[sortedKeys.length - 1]);
  const spanDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  // If span > 60 days, aggregate by month for a cleaner chart
  if (spanDays > 60) {
    const monthMap = new Map<string, { current: number; simulated: number }>();
    for (const [dateKey, val] of map.entries()) {
      const monthKey = dateKey.slice(0, 7); // YYYY-MM
      const mEntry = monthMap.get(monthKey) ?? { current: 0, simulated: 0 };
      mEntry.current += val.current;
      mEntry.simulated += val.simulated;
      monthMap.set(monthKey, mEntry);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        current_revenue: round2(v.current),
        simulated_revenue: round2(v.simulated),
      }));
  }

  // Day-level granularity
  return sortedKeys.map((date) => {
    const v = map.get(date)!;
    return {
      date,
      current_revenue: round2(v.current),
      simulated_revenue: round2(v.simulated),
    };
  });
}

/**
 * Fetch a sample of order lines with customer and product metadata.
 * Uses recent orders first (most relevant for impact analysis).
 */
async function fetchSampleLines(
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

function buildTopCustomers(
  map: Map<string, { kundenavn: string; current: number; simulated: number }>,
  limit: number,
): CustomerImpact[] {
  return Array.from(map.entries())
    .map(([kundenr, v]) => ({
      kundenr,
      kundenavn: v.kundenavn,
      current_revenue: round2(v.current),
      simulated_revenue: round2(v.simulated),
      difference: round2(v.simulated - v.current),
      difference_pct: pctChange(v.current, v.simulated),
    }))
    .filter((c) => c.difference !== 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, limit);
}

function buildTopProducts(
  map: Map<string, { varenavn: string; current: number; simulated: number }>,
  limit: number,
): ProductImpact[] {
  return Array.from(map.entries())
    .map(([varekode, v]) => ({
      varekode,
      varenavn: v.varenavn,
      current_revenue: round2(v.current),
      simulated_revenue: round2(v.simulated),
      difference: round2(v.simulated - v.current),
      difference_pct: pctChange(v.current, v.simulated),
    }))
    .filter((p) => p.difference !== 0)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, limit);
}
