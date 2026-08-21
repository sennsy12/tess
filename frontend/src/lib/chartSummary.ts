import { percentChange } from './chartUtils';

/** Build a short Norwegian screen-reader summary for time-series revenue charts. */
export function revenueTrendSummary(
  points: Array<{ total_sum?: number; period?: string }>,
  valueLabel = 'Omsetning',
): string | undefined {
  if (!points || points.length < 2) return undefined;
  const values = points.map((p) => Number(p.total_sum) || 0);
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0 && last === 0) return undefined;
  const pct = percentChange(last, first);
  if (pct === null) return undefined;
  const direction = pct >= 0 ? 'økte' : 'falt';
  return `${valueLabel} ${direction} ${Math.abs(pct)}% fra første til siste periode i grafen (${points.length} punkter).`;
}
