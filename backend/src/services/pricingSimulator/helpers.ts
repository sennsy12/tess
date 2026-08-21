import type { ProposedRule, RevenueBucket, SimulationResult } from '../../types/simulation.js';

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
export function pctChange(current: number, simulated: number): number {
  if (current === 0) return simulated === 0 ? 0 : 100;
  return Math.round(((simulated - current) / Math.abs(current)) * 10000) / 100;
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
