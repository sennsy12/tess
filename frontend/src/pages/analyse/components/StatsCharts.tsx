import { BarChart, PieChart } from '../../../components/Charts';

interface StatsChartsProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
  comparison?: {
    currentTotal: number;
    previousTotal: number;
    deltaPercent: number | null;
  } | null;
}

export function StatsCharts({ data, nameKey, title, currencyFormatter, comparison }: StatsChartsProps) {
  const deltaClass = comparison?.deltaPercent === null
    ? 'text-dark-300'
    : comparison?.deltaPercent !== undefined && comparison.deltaPercent >= 0
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="space-y-6">
      {comparison && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-400">Sammenligning mot forrige periode</p>
            <p className="text-lg font-semibold">{currencyFormatter(comparison.currentTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-dark-400">Forrige periode</p>
            <p className="font-medium">{currencyFormatter(comparison.previousTotal)}</p>
            <p className={`text-sm ${deltaClass}`}>
              {comparison.deltaPercent === null ? '—' : `${comparison.deltaPercent.toFixed(1)}%`}
            </p>
          </div>
        </div>
      )}
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
    </div>
  );
}
