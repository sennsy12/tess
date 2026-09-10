import { useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { Layout } from '../../components/Layout';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import {
  statusApi,
  dashboardApi,
  ordersApi,
} from '../../lib/api';
import { StatCardSkeleton, ChartSkeleton } from '../../components/admin';
import { reportError } from '../../lib/observability';
import { formatCurrencyNok, formatNumberNb, abbreviateCurrencyNok } from '../../lib/formatters';
import { statusKeys, dashboardKeys } from '../../lib/queryKeys';
import { usePendingApprovalCount } from '../../hooks/useApprovals';
import { fillMissingPeriods } from '../../lib/chartUtils';
import { positiveRevenue, sparkSeries } from '../../lib/statsAggregation';
import { StatCard } from '../../components/StatCard';
import {
  TopProductsWidget,
  TopCustomersWidget,
  PriceDeviationsWidget,
  DataStatusWidget,
} from './dashboard/widgets';
import { DashboardAnalytics } from '../../types/dashboard';

export function AdminDashboard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queriesEnabled = isAuthenticated && !authLoading;

  const { data: status } = useQuery({
    queryKey: statusKeys.system(),
    queryFn: () =>
      statusApi
        .getStatus()
        .then((res) => res.data)
        .catch((err: unknown) => {
          // Non-critical widget: degrade to null but keep telemetry.
          reportError(err, { source: 'admin-dashboard-status' });
          return null;
        }),
    enabled: queriesEnabled,
  });

  const {
    data: widgets,
    isError: widgetsError,
    refetch: refetchWidgets,
  } = useQuery({
    queryKey: dashboardKeys.widgets(),
    queryFn: () => dashboardApi.getWidgets().then((res) => res.data),
    enabled: queriesEnabled,
  });

  const { data: apiMetrics } = useQuery({
    queryKey: dashboardKeys.apiMetrics(),
    queryFn: () =>
      statusApi
        .getApiMetrics()
        .then((res) => res.data)
        .catch((err: unknown) => {
          reportError(err, { source: 'admin-dashboard-api-metrics' });
          return null;
        }),
    enabled: queriesEnabled,
  });

  const { data: ordersNeedingAttention = 0 } = useQuery({
    queryKey: dashboardKeys.ordersNeedingAttention(),
    enabled: queriesEnabled,
    queryFn: async () => {
      const response = await ordersApi.getAll({ limit: 100 });
      const rows = response.data?.data ?? [];
      return rows.filter((order) => !order.kunderef || !String(order.kunderef).trim()).length;
    },
  });

  // Shared with the sidebar badge (`PendingApprovalsBadge`) via the same
  // query key — one `GET /orders?workflowStatus=pending_approval&limit=1`
  // regardless of how many consumers are mounted.
  const { data: pendingApprovalCount = 0 } = usePendingApprovalCount({ enabled: queriesEnabled });

  const { data: analytics, isLoading } = useQuery({
    queryKey: dashboardKeys.analytics(),
    queryFn: () => dashboardApi.getAnalyticsBatch().then(res => res.data as DashboardAnalytics),
    enabled: queriesEnabled,
  });

  const summary = analytics?.summary ?? null;
  const analyticsTimeSeries = analytics?.timeSeries;
  const analyticsFirma = analytics?.firma?.data;
  const analyticsLager = analytics?.lager?.data;
  const timeSeries = useMemo(
    () => fillMissingPeriods(analyticsTimeSeries ?? [], 'month'),
    [analyticsTimeSeries],
  );
  // Einstein: memoize derivations — previously .filter/.map ran every render
  // and produced new spark refs that forced recharts to re-render on any
  // polling refetch (pendingApprovalCount polls every 60s).
  // Math lives in lib/statsAggregation (pure, vitest-isolated).
  const { firmaStats, lagerStats, revenueSpark, orderCountSpark } = useMemo(() => {
    return {
      firmaStats: positiveRevenue(analyticsFirma ?? []),
      lagerStats: positiveRevenue(analyticsLager ?? []),
      revenueSpark: sparkSeries(timeSeries, 'total_sum'),
      orderCountSpark: sparkSeries(timeSeries, 'order_count'),
    };
  }, [analyticsFirma, analyticsLager, timeSeries]);

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        {/* System status */}
        <div className="card bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-700/50 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${status?.status === 'healthy' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold">System Status</h3>
                <p className="text-sm text-dark-400">{status?.status === 'healthy' ? 'Alt fungerer normalt' : 'Problemer oppdaget'}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-right">
              <span className="text-xs font-medium uppercase tracking-wider text-dark-400">Database</span>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-dark-100">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${status?.database?.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]'}`}
                  aria-hidden
                />
                {status?.database?.connected ? 'Tilkoblet' : 'Frakoblet'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards row 1 - Database counts */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
            <StatCard label="Ordrer i DB" value={formatNumberNb(status?.tables?.orders || 0)} numericValue={status?.tables?.orders || 0} />
            <StatCard label="Kunder i DB" value={formatNumberNb(status?.tables?.customers || 0)} numericValue={status?.tables?.customers || 0} />
            <StatCard label="Produkter i DB" value={formatNumberNb(status?.tables?.products || 0)} numericValue={status?.tables?.products || 0} />
            <StatCard label="Brukere i DB" value={formatNumberNb(status?.tables?.users || 0)} numericValue={status?.tables?.users || 0} />
          </div>
        )}

        {/* Stats cards row 2 - Business metrics */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
            <StatCard
              label="Total Omsetning"
              value={formatCurrencyNok(summary?.totalRevenue || 0)}
              numericValue={summary?.totalRevenue || 0}
              format={formatCurrencyNok}
              className="gradient-primary text-white"
              labelClassName="text-white/80"
              sparkData={revenueSpark}
              sparkDataKey="value"
              sparkColor="#ffffff"
            />
            <StatCard
              label="Totale Ordrer"
              value={formatNumberNb(summary?.totalOrders || 0)}
              numericValue={summary?.totalOrders || 0}
              className="gradient-success text-white"
              labelClassName="text-white/80"
              sparkData={orderCountSpark}
              sparkDataKey="value"
              sparkColor="#ffffff"
            />
            <StatCard
              label="Aktive Kunder"
              value={formatNumberNb(summary?.activeCustomers || 0)}
              numericValue={summary?.activeCustomers || 0}
              className="gradient-warning text-white"
              labelClassName="text-white/80"
            />
            <StatCard
              label="Produkter Solgt"
              value={formatNumberNb(summary?.productsOrdered || 0)}
              numericValue={summary?.productsOrdered || 0}
              className="gradient-danger text-white"
              labelClassName="text-white/80"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <ActionCard
            label="Ordrer til godkjenning"
            value={pendingApprovalCount}
            description="Kundebestillinger som venter på godkjenning eller avvisning."
            cta="Åpne godkjenningskøen"
            onClick={() => navigate('/admin/approvals')}
          />
          <ActionCard
            label="Ordrer trenger oppfølging"
            value={ordersNeedingAttention}
            description="Nylige ordrer mangler kunderef og bør kontrolleres."
            cta="Åpne ordrelisten"
            onClick={() => navigate('/admin/orders')}
          />
          <ActionCard
            label="Trege endepunkter"
            value={apiMetrics?.summary?.totalSlowRequests ?? 0}
            description="Endpoint-kall over 1 sekund trenger oppfølging."
            cta="Se status og ytelse"
            onClick={() => navigate('/admin/status')}
          />
          <ActionCard
            label="Prisavvik å gjennomgå"
            value={widgets?.priceDeviations?.length ?? 0}
            description="Kunder med avvikende prisnivå eller mange rabatter."
            cta="Åpne prisstyring"
            onClick={() => navigate('/admin/pricing')}
          />
          <ActionCard
            label="Datainntak siste døgn"
            value={widgets?.recentActivity?.dataFreshness?.daysSinceLastOrder ?? 0}
            suffix="d"
            description="Hvis dette tallet er høyt, bør import og ETL sjekkes."
            cta="Åpne ETL"
            onClick={() => navigate('/admin/etl')}
          />
        </div>

        {/* Widget row - Top Products and Top Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopProductsWidget
            data={widgets?.topProducts || []}
            isLoading={!widgets && !widgetsError}
            isError={widgetsError}
            onRetry={() => refetchWidgets()}
          />
          <TopCustomersWidget
            data={widgets?.topCustomers || []}
            isLoading={!widgets && !widgetsError}
            isError={widgetsError}
            onRetry={() => refetchWidgets()}
          />
        </div>

        {/* Widget row - Price Deviations and Data Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PriceDeviationsWidget
            data={widgets?.priceDeviations || []}
            isLoading={!widgets && !widgetsError}
            isError={widgetsError}
            onRetry={() => refetchWidgets()}
          />
          <DataStatusWidget
            data={widgets?.recentActivity || null}
            isLoading={!widgets && !widgetsError}
            isError={widgetsError}
            onRetry={() => refetchWidgets()}
          />
        </div>

        {/* Export button */}
        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="admin-dashboard" />
        </div>

        {/* Charts */}
        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          <div ref={chartRef} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LineChart
                data={timeSeries}
                xKey="period"
                yKey="total_sum"
                title="Omsetning over tid"
                color="#10b981"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
                tickFormatter={abbreviateCurrencyNok}
              />
              <BarChart
                data={timeSeries}
                xKey="period"
                yKey="order_count"
                title="Ordrer per måned"
                color="#8b5cf6"
                seriesName="Antall Ordrer"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PieChart
                data={firmaStats}
                nameKey="firmanavn"
                valueKey="total_sum"
                title="Omsetning per Firma"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
                height={360}
              />
              <BarChart
                data={lagerStats}
                xKey="lagernavn"
                yKey="total_sum"
                title="Omsetning per Lager"
                color="#f59e0b"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
                tickFormatter={abbreviateCurrencyNok}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ActionCard({
  label,
  value,
  description,
  cta,
  suffix = '',
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  cta: string;
  suffix?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="card text-left transition-all duration-200 hover:border-primary-500/40 hover:bg-dark-800/50"
    >
      <p className="text-sm text-dark-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-dark-100">
        {value}
        {suffix}
      </p>
      <p className="mt-3 text-sm text-dark-400">{description}</p>
      <p className="mt-4 text-sm font-medium text-primary-300">{cta} →</p>
    </button>
  );
}
