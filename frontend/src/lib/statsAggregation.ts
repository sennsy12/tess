/**
 * Statistikk-aggregering for dashboards, KPI-striper og StatCard.
 *
 * Rene funksjoner (ingen React, ingen sideeffekter): queries -> rådata ->
 * `sumBy()` / `latestByString()` / `positiveRevenue()` / `sparkSeries()` ->
 * UI-komponenter. Testes isolert med vitest
 * (se lib/__tests__/statsAggregation.test.ts).
 *
 * Regel: nullish/NaN tallverdier behandles som 0 – summer og sparklines skal
 * aldri bli NaN på grunn av manglende data. `latestByString()` sammenligner
 * ISO-datoer leksikografisk (streng > streng), som gir korrekt rekkefølge
 * for «YYYY-MM-DD»-nøkler.
 */

/** Single-pass sum. Nullish/NaN resultat fra `by` teller som 0. */
export function sumBy<T>(items: readonly T[], by: (item: T) => number): number {
  let total = 0;
  for (const item of items) {
    total += by(item) || 0;
  }
  return total;
}

/**
 * Returnerer raden der `by`-strengen (ISO-dato) sorterer høyest, eller null
 * ved tomt input. Sammenligningen er leksikografisk – korrekt for
 * «YYYY-MM-DD»-nøkler. Ved lik nøkkel vinner den første raden.
 */
export function latestByString<T>(items: readonly T[], by: (item: T) => string): T | null {
  let latest: T | null = null;
  let latestKey = '';
  for (const item of items) {
    const key = by(item);
    if (latest === null || key > latestKey) {
      latest = item;
      latestKey = key;
    }
  }
  return latest;
}

/**
 * Filtrerer bort rader uten positiv omsetning: kun rader der
 * Number(total_sum) > 0 beholder (nullish -> NaN/0 -> ut). Rekkefølgen på
 * radene er uendret, og input muteres ikke.
 */
export function positiveRevenue<T extends { total_sum?: number | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => Number(row.total_sum) > 0);
}

/**
 * Mapper tidsseriepunkter til sparkline-serie for StatCard
 * (`Array<{ value: number }>`, samme rekkefølge som input). Nullish verdier
 * blir 0. Nøkkelen velger om serien viser omsetning (total_sum) eller
 * ordreantall (order_count). Generisk så både lib/api- og
 * types/dashboard-variantene av TimeSeriesPoint kan brukes.
 */
export function sparkSeries<
  P extends { total_sum?: number | null; order_count?: number | null },
>(
  points: readonly P[],
  key: 'total_sum' | 'order_count',
): Array<{ value: number }> {
  return points.map((point) => ({ value: point[key] ?? 0 }));
}