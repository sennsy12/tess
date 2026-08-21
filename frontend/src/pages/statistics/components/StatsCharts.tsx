import { useMemo } from 'react';
import { BarChart, PieChart } from '../../../components/Charts';
import { abbreviateCurrencyNok } from '../../../lib/formatters';
import { topN } from '../../../lib/chartUtils';
import { StatsChartsProps } from '../../../types/statistics';

const CHART_COLOR = '#6366f1';

export function StatsCharts({ data, nameKey, title, currencyFormatter }: StatsChartsProps) {
  const barData = useMemo(
    () => topN(data, 15, (item) => Number(item.total_sum) || 0),
    [data],
  );

  const pieData = useMemo(
    () =>
      topN(data, 8, (item) => Number(item.total_sum) || 0, {
        withOther: true,
        createOther: (sum) =>
          ({
            [nameKey]: 'Andre',
            total_sum: sum,
          }) as (typeof data)[number],
      }),
    [data, nameKey],
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="card">
        <BarChart
          data={barData}
          xKey={nameKey}
          yKey="total_sum"
          title={`${title} - Omsetning`}
          seriesName="Omsetning"
          valueFormatter={currencyFormatter}
          tickFormatter={abbreviateCurrencyNok}
          color={CHART_COLOR}
          height={320}
        />
      </div>
      <div className="card">
        <PieChart
          data={pieData}
          nameKey={nameKey}
          valueKey="total_sum"
          title={`${title} - Fordeling`}
          seriesName="Omsetning"
          valueFormatter={currencyFormatter}
          height={360}
        />
      </div>
    </div>
  );
}
