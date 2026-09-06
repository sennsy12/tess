/**
 * Felles avrundingshjelper (2 desimaler).
 *
 * Kanonisk `Math.round(x * 100) / 100`-semantikk, delt av
 * `services/pricingMath.ts`, `services/pricingSimulator/helpers.ts` og
 * `lib/orderTotals.ts`. Mottar IKKE sammenslåing av prising-matte (risikabelt) —
 * kun denne trygge, rene funksjonen deles. Signaturer beholdes.
 *
 * @module lib/round
 */

/** Rund av til 2 desimaler (banker's? nei — standard halv-opp via Math.round). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
