import type { ProposedRule, RevenueBucket, SimulationResult } from '../../types/simulation.js';
import { round2 } from '../../lib/round.js';

// Re-eksportert for bakoverkompatibilitet: eksisterende importører
// (`pricingSimulatorService`, `aggregations`) importerer `round2` herfra.
// Kanonisk implementasjon bor i `lib/round.ts` (samme Math.round(x*100)/100).
export { round2 };

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Raw order-line row returned by the sample query. */
export interface SampleLine {
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
export function ruleMatchesLine(rule: ProposedRule, line: SampleLine): boolean {
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
export function applyProposedRule(
  rule: ProposedRule,
  unitPrice: number,
  quantity: number,
): number {
  if (rule.fixed_price != null) {
    return round2(Number(rule.fixed_price) * quantity);
  }
  if (rule.discount_percent != null) {
    const multiplier = 1 - Number(rule.discount_percent) / 100;
    return round2(unitPrice * multiplier * quantity);
  }
  // No discount → unchanged
  return round2(unitPrice * quantity);
}

/** Compute percentage change, safe against division by zero. */
export function pctChange(current: number, simulated: number): number {
  if (current === 0) return simulated === 0 ? 0 : 100;
  return round2(((simulated - current) / Math.abs(current)) * 100);
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

export function createBucket(): RevenueBucket {
  return { total_revenue: 0, total_discount: 0, affected_orders: 0, affected_lines: 0 };
}

export function emptyResult(ms: number): SimulationResult {
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
export function toDateKey(dato: string | Date): string {
  const d = dato instanceof Date ? dato : new Date(dato);
  return d.toISOString().slice(0, 10);
}
