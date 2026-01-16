import { BarChart, PieChart } from '../../../components/Charts';

interface StatsChartsProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
}

export function StatsCharts({ data, nameKey, title, currencyFormatter }: StatsChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="card">
        <BarChart
          data={data.slice(0, 15)}
          xKey={nameKey}
          yKey="total_sum"
          title={`${title} - Omsetning`}
          seriesName="Omsetning"
          valueFormatter={currencyFormatter}
        />
      </div>
      <div className="card">
        <PieChart
          data={data.slice(0, 8)}
          nameKey={nameKey}
          valueKey="total_sum"
          title={`${title} - Fordeling`}
          seriesName="Omsetning"
          valueFormatter={currencyFormatter}
        />
      </div>
    </div>
  );
}
