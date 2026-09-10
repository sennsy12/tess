import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { EmptyState } from '../../components/EmptyState';
import { LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { statisticsApi, ordersApi, type TimeSeriesPoint } from '../../lib/api';
import { kundeKeys } from '../../lib/queryKeys';
import { useAuth } from '../../context/useAuth';
import { StatCard } from '../../components/StatCard';
import { StatCardSkeleton, ChartSkeleton } from '../../components/admin';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { QueryRefetchBar } from '../../components/QueryRefetchBar';
import { getApiError } from '../../lib/apiErrors';
import { revenueTrendSummary } from '../../lib/chartSummary';
import { fillMissingPeriods } from '../../lib/chartUtils';
import { formatCurrencyNok, formatDateNb, formatMoneyNok, formatNumberNb } from '../../lib/formatters';
import { positiveRevenue, sparkSeries } from '../../lib/statsAggregation';
import type { Order } from '../../types/order';

export function KundeDashboard() {
  const { user } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // One request instead of three: `/statistics/batch` computes summary +
  // varegruppe + time-series in parallel server-side (same model functions
  // the individual endpoints run, so values are identical) and returns them
  // in a single round trip. The `kunde` dimension batch also returns is not
  // needed here — its cost is ~one bounded top-50 GROUP BY, which is cheaper
  // than the two extra HTTP round trips it saves.
  const dashboardQuery = useQuery({
    queryKey: [...kundeKeys.summary(), 'batch'],
    queryFn: async () => {
      const { data } = await statisticsApi.batch({ groupBy: 'month' });
      return {
        summary: data.summary,
        timeSeries: data.timeSeries ?? [],
        varegruppe: data.varegruppe?.data ?? [],
      };
    },
    staleTime: 60_000,
  });

  const recentOrdersQuery = useQuery({
    queryKey: kundeKeys.recentOrders(),
    queryFn: async (): Promise<Order[]> => {
      const res = await ordersApi.getAll({ limit: 5, page: 1 });
      const payload = res.data as unknown;
      if (Array.isArray(payload)) return (payload as Order[]).slice(0, 5);
      if (payload && typeof payload === 'object' && 'data' in payload && Array.isArray((payload as { data: unknown }).data)) {
        return ((payload as { data: Order[] }).data).slice(0, 5);
      }
      return [];
    },
    staleTime: 60_000,
  });

  const summary = dashboardQuery.data?.summary ?? null;
  const recentOrders: Order[] = recentOrdersQuery.data ?? [];
  const varegruppeRaw = dashboardQuery.data?.varegruppe;
  const timeSeriesRaw = dashboardQuery.data?.timeSeries;
  const timeSeries: TimeSeriesPoint[] = useMemo(
    () => fillMissingPeriods(timeSeriesRaw ?? [], 'month'),
    [timeSeriesRaw],
  );

  // Einstein: single-pass derivations — previously .filter/.map ran 2-3x per
  // render and created new spark refs that defeated memo in StatCard/Sparkline.
  // Math lives in lib/statsAggregation (pure, vitest-isolated).
  const { orderCountSpark, revenueSpark, positiveVaregrupper, varegruppeCount } = useMemo(() => {
    const positiveVaregrupper = positiveRevenue(varegruppeRaw ?? []);
    return {
      orderCountSpark: sparkSeries(timeSeries, 'order_count'),
      revenueSpark: sparkSeries(timeSeries, 'total_sum'),
      positiveVaregrupper,
      varegruppeCount: positiveVaregrupper.length,
    };
  }, [timeSeries, varegruppeRaw]);

  const isLoading =
    dashboardQuery.isLoading ||
    recentOrdersQuery.isLoading;

  // Any failed widget is critical — previously only summary && timeSeries
  // counted, so varegruppe/recent failures were silent.
  const hasCriticalError =
    dashboardQuery.isError ||
    recentOrdersQuery.isError;

  const dashboardErrorMessage = getApiError(
    dashboardQuery.error ?? recentOrdersQuery.error,
    'Noe av dashboard-data kunne ikke lastes.',
  );

  const showRefetchBar =
    !isLoading &&
    (dashboardQuery.isFetching || recentOrdersQuery.isFetching) &&
    Boolean(summary ?? timeSeries.length > 0);

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

  const currencyFormatter = formatCurrencyNok;

  return (
    <Layout title="Kunde Dashboard">
      <div className="space-y-6">
        {hasCriticalError && (
          <QueryErrorBanner
            message={dashboardErrorMessage}
            onRetry={() => {
              void dashboardQuery.refetch();
              void recentOrdersQuery.refetch();
            }}
          />
        )}
        {showRefetchBar && <QueryRefetchBar active />}
        {/* Welcome message */}
        <div className="card bg-gradient-to-r from-primary-600/20 to-primary-800/20 border-primary-700/50 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-dark-50">
                Velkommen, {user?.kundenr || user?.username}!
              </h3>
              <p className="text-dark-300 mt-1">
                Her er en oversikt over dine ordrer og statistikk.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/kunde/order/new')}
              className="btn-primary whitespace-nowrap self-start sm:self-auto"
            >
              + Ny bestilling
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          <StatCard
            label="Totale Ordrer"
            value={formatNumberNb(summary?.totalOrders || 0)}
            numericValue={summary?.totalOrders || 0}
            sparkData={orderCountSpark}
            sparkDataKey="value"
            sparkColor="#6366f1"
          />
          <StatCard
            label="Total Omsetning"
            value={currencyFormatter(summary?.totalRevenue || 0)}
            numericValue={summary?.totalRevenue || 0}
            format={currencyFormatter}
            sparkData={revenueSpark}
            sparkDataKey="value"
            sparkColor="#10b981"
          />
          <StatCard
            label="Produkter Bestilt"
            value={formatNumberNb(summary?.productsOrdered || 0)}
            numericValue={summary?.productsOrdered || 0}
          />
          <StatCard
            label="Gjennomsnitt/Ordre"
            value={currencyFormatter(Math.round((summary?.totalRevenue || 0) / Math.max(summary?.totalOrders || 1, 1)))}
            numericValue={Math.round((summary?.totalRevenue || 0) / Math.max(summary?.totalOrders || 1, 1))}
            format={currencyFormatter}
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
              data={positiveVaregrupper}
              nameKey="varegruppe"
              valueKey="total_sum"
              title="Fordeling per varegruppe"
              seriesName="Omsetning"
              valueFormatter={currencyFormatter}
              summary={
                varegruppeCount > 0
                  ? `Fordeling på ${varegruppeCount} varegrupper med omsetning.`
                  : undefined
              }
            />
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Siste Ordrer</h3>
          {recentOrdersQuery.isError && recentOrders.length === 0 ? (
            <QueryErrorBanner
              message={getApiError(recentOrdersQuery.error, 'Kunne ikke laste siste ordrer')}
              onRetry={() => void recentOrdersQuery.refetch()}
            />
          ) : recentOrders.length === 0 ? (
            <EmptyState
              title="Ingen ordrer ennå"
              description="Når du legger inn bestillinger vil de vises her."
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th scope="col" className="table-header">Ordrenr</th>
                  <th scope="col" className="table-header">Dato</th>
                  <th scope="col" className="table-header">Firma</th>
                  <th scope="col" className="table-header">Sum</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.ordrenr}
                    className="cursor-pointer hover:bg-dark-800/30"
                    onClick={() => navigate(`/kunde/orders/${order.ordrenr}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/kunde/orders/${order.ordrenr}`);
                      }
                    }}
                  >
                    <td className="table-cell font-medium text-primary-400">
                      <Link
                        to={`/kunde/orders/${order.ordrenr}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
                      >
                        #{order.ordrenr}
                      </Link>
                    </td>
                    <td className="table-cell">
                      {formatDateNb(order.dato)}
                    </td>
                    <td className="table-cell">{order.firmanavn || '-'}</td>
                    <td className="table-cell font-semibold">
                      {formatMoneyNok(order.sum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
