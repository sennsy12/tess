/** Row-based completion for ETL jobs when an estimated total is known (0–100, rounded). */
export function computeEtlProgressPercent(
  attemptedRows: number,
  estimatedTotal?: number | null,
): number | null {
  if (estimatedTotal == null || estimatedTotal <= 0) return null;
  const ratio = attemptedRows / estimatedTotal;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}
