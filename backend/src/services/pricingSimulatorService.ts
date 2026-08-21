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
 * Split into single-responsibility modules under `pricingSimulator/`;
 * this file keeps the public service object so the API is unchanged.
 *
 * @module services/pricingSimulatorService
 */

import type {
  SimulationRequest,
  SimulationResult,
} from '../types/simulation.js';
import {
  applyProposedRule,
  createBucket,
  emptyResult,
  pctChange,
  round2,
  ruleMatchesLine,
  toDateKey,
} from './pricingSimulator/helpers.js';
import { fetchSampleLines } from './pricingSimulator/sampleQuery.js';
import { buildTopCustomers, buildTopProducts, buildTrend } from './pricingSimulator/aggregations.js';

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
