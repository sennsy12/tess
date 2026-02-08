/**
 * Pricing Simulation Type Definitions
 *
 * Types for the "What-If" analysis feature that lets admins
 * simulate the revenue impact of pricing rule changes against
 * historical order data.
 *
 * @module types/simulation
 */

// ────────────────────────────────────────────────────────────
// Request types
// ────────────────────────────────────────────────────────────

/** A proposed rule change to simulate (mirrors PriceRule fields). */
export interface ProposedRule {
  /** Existing rule ID being modified (null for a brand-new rule) */
  rule_id?: number | null;
  price_list_id: number;
  varekode?: string | null;
  varegruppe?: string | null;
  kundenr?: string | null;
  customer_group_id?: number | null;
  min_quantity?: number;
  discount_percent?: number | null;
  fixed_price?: number | null;
}

/** Payload sent to `POST /api/pricing/simulate`. */
export interface SimulationRequest {
  /** The proposed rule change to evaluate */
  proposed_rule: ProposedRule;
  /** Date range to pull historical orders from (ISO date strings) */
  start_date?: string;
  end_date?: string;
  /** Max number of orders to sample (default 1000, cap 5000) */
  sample_size?: number;
}

// ────────────────────────────────────────────────────────────
// Response types
// ────────────────────────────────────────────────────────────

/** Revenue totals for one side of the comparison. */
export interface RevenueBucket {
  total_revenue: number;
  total_discount: number;
  affected_orders: number;
  affected_lines: number;
}

/** Per-customer impact row (top movers). */
export interface CustomerImpact {
  kundenr: string;
  kundenavn: string;
  current_revenue: number;
  simulated_revenue: number;
  difference: number;
  difference_pct: number;
}

/** Per-product impact row. */
export interface ProductImpact {
  varekode: string;
  varenavn: string;
  current_revenue: number;
  simulated_revenue: number;
  difference: number;
  difference_pct: number;
}

/** Full response from the simulation endpoint. */
export interface SimulationResult {
  /** Summarised before / after numbers */
  current: RevenueBucket;
  simulated: RevenueBucket;
  /** Net change */
  revenue_difference: number;
  revenue_difference_pct: number;
  /** How many orders were analysed */
  orders_analysed: number;
  /** Top customers affected (sorted by absolute difference) */
  top_customers: CustomerImpact[];
  /** Top products affected */
  top_products: ProductImpact[];
  /** Wall-clock time of the simulation (ms) */
  computation_time_ms: number;
}
