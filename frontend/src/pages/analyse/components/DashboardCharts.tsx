import { BarChart, LineChart, PieChart } from '../../../components/Charts';

interface DashboardChartsProps {
  timeSeries: any[];
  kundeStats: any[];
  varegruppeStats: any[];
  currencyFormatter: (value: number) => string;
}

export function DashboardCharts({
  timeSeries,
  kundeStats,
  varegruppeStats,
  currencyFormatter,
}: DashboardChartsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <LineChart
            data={timeSeries}
            xKey="period"
            yKey="total_sum"
            title="Omsetning over tid"
            color="#10b981"
            seriesName="Omsetning"
            valueFormatter={currencyFormatter}
          />
        </div>
        <div className="card">
          <BarChart
            data={timeSeries}
            xKey="period"
            yKey="order_count"
            title="Antall ordrer per måned"
            color="#8b5cf6"
            seriesName="Antall Ordrer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <BarChart
            data={kundeStats}
            xKey="kundenavn"
            yKey="total_sum"
            title="Topp 10 Kunder (Omsetning)"
            color="#6366f1"
            seriesName="Omsetning"
            valueFormatter={currencyFormatter}
          />
        </div>
        <div className="card">
          <PieChart
            data={varegruppeStats}
            nameKey="varegruppe"
            valueKey="total_sum"
            title="Omsetning per Varegruppe"
            seriesName="Omsetning"
            valueFormatter={currencyFormatter}
          />
        </div>
      </div>
    </div>
  );
}
