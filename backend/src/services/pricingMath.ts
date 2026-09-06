import type { PriceCalculationResult, PriceRule } from '../types/pricing.js';
import { round2 } from '../lib/round.js';

export function calculateMargin(cost: number, price: number): number {
  return price - cost;
}

export function calculateMarginPercent(cost: number, price: number): number {
  if (price === 0) return 0;
  return round2(((price - cost) / price) * 100);
}

export function formatRuleName(rule: PriceRule): string {
  const parts: string[] = [];

  if (rule.discount_percent != null) {
    parts.push(`${rule.discount_percent}% rabatt`);
  } else if (rule.fixed_price != null) {
    parts.push(`Fast pris ${rule.fixed_price}`);
  }

  if (rule.varekode) {
    parts.push(`på ${rule.varekode}`);
  } else if (rule.varegruppe) {
    parts.push(`på ${rule.varegruppe}`);
  }

  if (rule.min_quantity > 1) {
    parts.push(`ved ${rule.min_quantity}+ stk`);
  }

  return parts.join(' ') || 'Prisregel';
}

export function applyBestRule(
  basePrice: number,
  quantity: number,
  rules: Array<PriceRule & { price_list_name?: string }>,
): PriceCalculationResult {
  const roundedOriginal = round2(basePrice * quantity);
  const result: PriceCalculationResult = {
    original_price: roundedOriginal,
    final_price: roundedOriginal,
    unit_price: round2(basePrice),
    discount_applied: false,
    discount_percent: null,
    discount_amount: 0,
    applied_rule_id: null,
    applied_rule_name: null,
    applied_list_name: null,
  };

  if (rules.length === 0) {
    return result;
  }

  const bestRule = rules[0];

  // Degenerate rule (neither fixed nor discount set) -> treat as no rule.
  // Prevents audit lie where empty rule reports as "applied".
  if (bestRule.fixed_price == null && bestRule.discount_percent == null) {
    return result;
  }

  let finalUnitPrice = basePrice;

  if (bestRule.fixed_price != null) {
    finalUnitPrice = round2(Number(bestRule.fixed_price));
    // Guard: base 0 has no meaningful discount percent — the division below
    // would yield NaN/Infinity. Discount is reported as 0; amounts still
    // compute (original 0 vs fixed*qty) with discount_applied=false.
    // (Beholdes; round2 gjenbruker samme Math.round(x*100)/100-semantikk.)
    result.discount_percent =
      basePrice === 0
        ? 0
        : round2(((basePrice - finalUnitPrice) / basePrice) * 100);
    result.unit_price = finalUnitPrice;
    result.final_price = round2(finalUnitPrice * quantity);
  } else if (bestRule.discount_percent != null) {
    const discountMultiplier = 1 - Number(bestRule.discount_percent) / 100;
    // Single-round policy: round once at line total to avoid øre drift
    // (matches pricingSimulator/helpers.applyProposedRule).
    finalUnitPrice = round2(basePrice * discountMultiplier);
    result.discount_percent = Number(bestRule.discount_percent);
    result.unit_price = finalUnitPrice;
    result.final_price = round2(basePrice * discountMultiplier * quantity);
  } else {
    return result;
  }

  result.discount_amount = round2(result.original_price - result.final_price);
  result.discount_applied = result.discount_amount > 0;
  result.applied_rule_id = bestRule.id;
  result.applied_rule_name = formatRuleName(bestRule);
  result.applied_list_name = bestRule.price_list_name ?? null;

  return result;
}
