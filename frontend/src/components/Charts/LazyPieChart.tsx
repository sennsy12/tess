import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';

const PieChartImpl = lazy(() =>
  import('./PieChart').then((m) => ({ default: m.PieChart })),
);

type PieChartProps = ComponentProps<typeof import('./PieChart').PieChart>;

export function LazyPieChart(props: PieChartProps) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-dark-800/50" />}>
      <PieChartImpl {...props} />
    </Suspense>
  );
}
