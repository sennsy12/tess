import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';

const BarChartImpl = lazy(() =>
  import('./BarChart').then((m) => ({ default: m.BarChart })),
);

type BarChartProps = ComponentProps<typeof import('./BarChart').BarChart>;

export function LazyBarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-dark-800/50" />}>
      <BarChartImpl {...props} />
    </Suspense>
  );
}
