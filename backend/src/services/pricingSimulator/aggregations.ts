import type { CustomerImpact, ProductImpact, TrendPoint } from '../../types/simulation.js';
import { pctChange, round2 } from './helpers.js';

/**
 * Convert the trendMap into a sorted array of TrendPoints.
 * Automatically groups into months if the date span exceeds 60 days.
 */
export function buildTrend(
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

export function buildTopCustomers(
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

export function buildTopProducts(
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
