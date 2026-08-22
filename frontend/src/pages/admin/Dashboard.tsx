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
import { formatCurrencyNok, abbreviateCurrencyNok } from '../../lib/formatters';
import { fillMissingPeriods } from '../../lib/chartUtils';
import { AnimatedStatCard } from '../../components/dashboard/AnimatedStatCard';
import {
  TopProductsWidget,
  TopCustomersWidget,
  PriceDeviationsWidget,
  DataStatusWidget,
} from './dashboard/widgets';
import { DashboardAnalytics, TimeSeriesPoint, FirmaLagerStat } from '../../types/dashboard';

export function AdminDashboard() {
  const chartRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queriesEnabled = isAuthenticated && !authLoading;

  const { data: status } = useQuery({
    queryKey: ['admin', 'status'],
    queryFn: () => statusApi.getStatus().then(res => res.data).catch(() => null),
    enabled: queriesEnabled,
  });

  const {
    data: widgets,
    isError: widgetsError,
    refetch: refetchWidgets,
  } = useQuery({
    queryKey: ['admin', 'widgets'],
    queryFn: () => dashboardApi.getWidgets().then((res) => res.data),
    enabled: queriesEnabled,
  });

  const { data: apiMetrics } = useQuery({
    queryKey: ['admin', 'dashboard-api-metrics'],
    queryFn: () => statusApi.getApiMetrics().then((res) => res.data).catch(() => null),
    enabled: queriesEnabled,
  });

  const { data: ordersNeedingAttention = 0 } = useQuery({
    queryKey: ['admin', 'orders-needing-attention'],
    enabled: queriesEnabled,
    queryFn: async () => {
      const response = await ordersApi.getAll({ limit: 100 });
      const rows = response.data?.data ?? [];
      return rows.filter((order) => !order.kunderef || !String(order.kunderef).trim()).length;
    },
  });

  const { data: pendingApprovalCount = 0 } = useQuery({
    queryKey: ['admin', 'pending-approval-count'],
    enabled: queriesEnabled,
    queryFn: async () => {
      const response = await ordersApi.getAll({ workflowStatus: 'pending_approval', limit: 1 });
      return response.data?.pagination?.total ?? 0;
    },
    refetchInterval: 60_000,
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => dashboardApi.getAnalyticsBatch().then(res => res.data as DashboardAnalytics),
    enabled: queriesEnabled,
  });

  const summary = analytics?.summary ?? null;
  const rawTimeSeries = analytics?.timeSeries ?? [];
  const timeSeries = useMemo(
    () => fillMissingPeriods(rawTimeSeries, 'month'),
    [rawTimeSeries],
  );
  const firmaStats = (analytics?.firma?.data ?? []).filter((f: FirmaLagerStat) => f.total_sum > 0);
  const lagerStats = (analytics?.lager?.data ?? []).filter((l: FirmaLagerStat) => l.total_sum > 0);

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
            <div className="text-right">
              <span className="text-sm text-dark-400">Database</span>
              <p className="font-medium">{status?.database?.connected ? '✅ Tilkoblet' : '❌ Frakoblet'}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-fade-in">
            <AnimatedStatCard label="Ordrer i DB" value={status?.tables?.orders || 0} />
            <AnimatedStatCard label="Kunder i DB" value={status?.tables?.customers || 0} />
            <AnimatedStatCard label="Produkter i DB" value={status?.tables?.products || 0} />
            <AnimatedStatCard label="Brukere i DB" value={status?.tables?.users || 0} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 stagger-fade-in">
            <AnimatedStatCard
              label="Total Omsetning"
              value={summary?.totalRevenue || 0}
              formatter={formatCurrencyNok}
              className="gradient-primary text-white"
              labelClassName="text-white/80"
              sparkData={timeSeries.map((t: TimeSeriesPoint) => ({ value: t.total_sum }))}
              sparkKey="value"
              sparkColor="#ffffff"
            />
            <AnimatedStatCard
              label="Totale Ordrer"
              value={summary?.totalOrders || 0}
              className="gradient-success text-white"
              labelClassName="text-white/80"
              sparkData={timeSeries.map((t: TimeSeriesPoint) => ({ value: t.order_count }))}
              sparkKey="value"
              sparkColor="#ffffff"
            />
            <AnimatedStatCard
              label="Aktive Kunder"
              value={summary?.activeCustomers || 0}
              className="gradient-warning text-white"
              labelClassName="text-white/80"
            />
            <AnimatedStatCard
              label="Produkter Solgt"
              value={summary?.productsOrdered || 0}
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
                title="📈 Omsetning over tid"
                color="#10b981"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
                tickFormatter={abbreviateCurrencyNok}
              />
              <BarChart
                data={timeSeries}
                xKey="period"
                yKey="order_count"
                title="📊 Ordrer per måned"
                color="#8b5cf6"
                seriesName="Antall Ordrer"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PieChart
                data={firmaStats}
                nameKey="firmanavn"
                valueKey="total_sum"
                title="🏢 Omsetning per Firma"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
                height={360}
              />
              <BarChart
                data={lagerStats}
                xKey="lagernavn"
                yKey="total_sum"
                title="📦 Omsetning per Lager"
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
