import type { PriceCalculationResult, PriceRule } from '../types/pricing.js';

export function calculateMargin(cost: number, price: number): number {
  return price - cost;
}

export function calculateMarginPercent(cost: number, price: number): number {
  if (price === 0) return 0;
  return Math.round(((price - cost) / price) * 100 * 100) / 100;
}

export function formatRuleName(rule: PriceRule): string {
  const parts: string[] = [];

  if (rule.discount_percent !== null) {
    parts.push(`${rule.discount_percent}% rabatt`);
  } else if (rule.fixed_price !== null) {
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
  const result: PriceCalculationResult = {
    original_price: basePrice * quantity,
    final_price: basePrice * quantity,
    unit_price: basePrice,
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
  let finalUnitPrice = basePrice;

  if (bestRule.fixed_price !== null) {
    finalUnitPrice = Number(bestRule.fixed_price);
    result.discount_percent = Math.round(((basePrice - finalUnitPrice) / basePrice) * 100 * 100) / 100;
  } else if (bestRule.discount_percent !== null) {
    const discountMultiplier = 1 - Number(bestRule.discount_percent) / 100;
    finalUnitPrice = Math.round(basePrice * discountMultiplier * 100) / 100;
    result.discount_percent = Number(bestRule.discount_percent);
  }

  result.unit_price = finalUnitPrice;
  result.final_price = Math.round(finalUnitPrice * quantity * 100) / 100;
  result.discount_amount = Math.round((result.original_price - result.final_price) * 100) / 100;
  result.discount_applied = result.discount_amount > 0;
  result.applied_rule_id = bestRule.id;
  result.applied_rule_name = formatRuleName(bestRule);
  result.applied_list_name = bestRule.price_list_name ?? null;

  return result;
}
