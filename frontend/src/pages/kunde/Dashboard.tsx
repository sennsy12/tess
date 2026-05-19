import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { statisticsApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../context/useAuth';
import { AnimatedStatCard } from '../../components/dashboard/AnimatedStatCard';
import { StatCardSkeleton, ChartSkeleton } from '../../components/admin';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { revenueTrendSummary } from '../../lib/chartSummary';

export function KundeDashboard() {
  const { user } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const summaryQuery = useQuery({
    queryKey: ['kunde', 'summary'],
    queryFn: () => statisticsApi.summary().then((res) => res.data),
  });

  const recentOrdersQuery = useQuery({
    queryKey: ['kunde', 'recentOrders'],
    queryFn: async () => {
      const res = await ordersApi.getAll({ limit: 5, page: 1 });
      const ordersData = res.data?.data || res.data || [];
      return ordersData.slice(0, 5);
    },
  });

  const varegruppeQuery = useQuery({
    queryKey: ['kunde', 'varegruppeStats'],
    queryFn: async () => {
      const res = await statisticsApi.byVaregruppe();
      return res.data?.data || res.data || [];
    },
  });

  const timeSeriesQuery = useQuery({
    queryKey: ['kunde', 'timeSeries'],
    queryFn: () => statisticsApi.timeSeries({ groupBy: 'month' }).then((res) => res.data),
  });

  const summary = summaryQuery.data;
  const recentOrders = recentOrdersQuery.data ?? [];
  const varegruppeStats = varegruppeQuery.data ?? [];
  const timeSeries = timeSeriesQuery.data ?? [];

  const isLoading =
    summaryQuery.isLoading ||
    timeSeriesQuery.isLoading ||
    varegruppeQuery.isLoading;

  const hasCriticalError =
    summaryQuery.isError && timeSeriesQuery.isError;

  if (isLoading && !hasCriticalError) {
    return (
      <Layout title="Dashboard">
        <div className="space-y-6">
          <div className="card"><div className="h-14 animate-pulse rounded bg-dark-700/40" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton /><ChartSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  return (
    <Layout title="Kunde Dashboard">
      <div className="space-y-6">
        {(summaryQuery.isError || timeSeriesQuery.isError) && (
          <QueryErrorBanner
            message="Noe av dashboard-data kunne ikke lastes."
            onRetry={() => {
              void summaryQuery.refetch();
              void timeSeriesQuery.refetch();
              void varegruppeQuery.refetch();
              void recentOrdersQuery.refetch();
            }}
          />
        )}
        {/* Welcome message */}
        <div className="card bg-gradient-to-r from-primary-600/20 to-primary-800/20 border-primary-700/50 animate-fade-in">
          <h3 className="text-xl font-semibold text-dark-50">
            Velkommen, {user?.kundenr || user?.username}! 👋
          </h3>
          <p className="text-dark-300 mt-1">
            Her er en oversikt over dine ordrer og statistikk.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-fade-in">
          <AnimatedStatCard
            label="Totale Ordrer"
            value={summary?.totalOrders || 0}
            sparkData={timeSeries.map((t: any) => ({ value: t.order_count ?? t.total_orders ?? 0 }))}
            sparkKey="value"
            sparkColor="#6366f1"
          />
          <AnimatedStatCard
            label="Total Omsetning"
            value={summary?.totalRevenue || 0}
            formatter={currencyFormatter}
            sparkData={timeSeries.map((t: any) => ({ value: t.total_sum ?? 0 }))}
            sparkKey="value"
            sparkColor="#10b981"
          />
          <AnimatedStatCard
            label="Produkter Bestilt"
            value={summary?.productsOrdered || 0}
          />
          <AnimatedStatCard
            label="Gjennomsnitt/Ordre"
            value={Math.round((summary?.totalRevenue || 0) / Math.max(summary?.totalOrders || 1, 1))}
            formatter={currencyFormatter}
          />
        </div>

        {/* Export button */}
        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="kunde-dashboard" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/kunde/orders')}
            className="card text-left transition-colors hover:bg-dark-800/50"
          >
            <p className="text-sm text-dark-400">Handling</p>
            <p className="mt-2 text-lg font-semibold text-dark-100">Se alle ordrer</p>
            <p className="mt-2 text-sm text-dark-400">Gå direkte til ordrelisten med søk, filtre og lagrede visninger.</p>
          </button>
          <button
            onClick={() => navigate('/kunde/analytics')}
            className="card text-left transition-colors hover:bg-dark-800/50"
          >
            <p className="text-sm text-dark-400">Analyse</p>
            <p className="mt-2 text-lg font-semibold text-dark-100">Kjør guidet analyse</p>
            <p className="mt-2 text-sm text-dark-400">Start med ferdige analyseoppsett for omsetning og varegrupper.</p>
          </button>
          <button
            onClick={() => navigate('/kunde/orders')}
            className="card text-left transition-colors hover:bg-dark-800/50"
          >
            <p className="text-sm text-dark-400">Oppfølging</p>
            <p className="mt-2 text-lg font-semibold text-dark-100">Sjekk siste kjøp</p>
            <p className="mt-2 text-sm text-dark-400">Åpne nylige ordrer og gå videre til detaljene med ett klikk.</p>
          </button>
        </div>

        {/* Charts */}
        <div ref={chartRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <LineChart
              data={timeSeries}
              xKey="period"
              yKey="total_sum"
              title="Omsetning over tid"
              seriesName="Omsetning"
              valueFormatter={currencyFormatter}
              summary={revenueTrendSummary(timeSeries)}
            />
          </div>
          <div className="card">
            <PieChart
              data={varegruppeStats.filter((v: any) => v.total_sum > 0)}
              nameKey="varegruppe"
              valueKey="total_sum"
              title="Fordeling per varegruppe"
              seriesName="Omsetning"
              valueFormatter={currencyFormatter}
              summary={
                varegruppeStats.length > 0
                  ? `Fordeling på ${varegruppeStats.filter((v: { total_sum: number }) => v.total_sum > 0).length} varegrupper med omsetning.`
                  : undefined
              }
            />
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Siste Ordrer</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Ordrenr</th>
                  <th className="table-header">Dato</th>
                  <th className="table-header">Firma</th>
                  <th className="table-header">Sum</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => (
                  <tr
                    key={order.ordrenr}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-dark-800/30"
                    onClick={() => navigate(`/kunde/orders/${order.ordrenr}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/kunde/orders/${order.ordrenr}`);
                      }
                    }}
                  >
                    <td className="table-cell font-medium text-primary-400">
                      #{order.ordrenr}
                    </td>
                    <td className="table-cell">
                      {new Date(order.dato).toLocaleDateString('nb-NO')}
                    </td>
                    <td className="table-cell">{order.firmanavn || '-'}</td>
                    <td className="table-cell font-semibold">
                      {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' })
                        .format(order.sum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
