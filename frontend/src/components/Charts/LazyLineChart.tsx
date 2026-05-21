import { lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';

const LineChartImpl = lazy(() =>
  import('./LineChart').then((m) => ({ default: m.LineChart })),
);

type LineChartProps = ComponentProps<typeof import('./LineChart').LineChart>;

export function LazyLineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-dark-800/50" />}>
      <LineChartImpl {...props} />
    </Suspense>
  );
}
