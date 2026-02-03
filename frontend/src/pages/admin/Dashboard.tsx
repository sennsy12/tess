import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import {
  statusApi,
  dashboardApi,
  StatisticsSummary,
  TimeSeriesPoint,
  FirmaStats,
  LagerStats,
} from '../../lib/api';
import { formatCurrencyNok, formatNumberNb } from '../../lib/formatters';
import {
  TopProductsWidget,
  TopCustomersWidget,
  PriceDeviationsWidget,
  DataStatusWidget,
  QuickActionsWidget,
} from './dashboard/widgets';

export function AdminDashboard() {
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [firmaStats, setFirmaStats] = useState<FirmaStats[]>([]);
  const [lagerStats, setLagerStats] = useState<LagerStats[]>([]);
  const [widgets, setWidgets] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load all data in parallel
      const [statusRes, widgetsRes, analyticsRes] = await Promise.all([
        statusApi.getStatus().catch(() => ({ data: null })),
        dashboardApi.getWidgets().catch(() => ({ data: null })),
        dashboardApi.getAnalyticsBatch(),
      ]);

      setStatus(statusRes.data);
      setWidgets(widgetsRes.data);
      setSummary(analyticsRes.data.summary);
      setTimeSeries(analyticsRes.data.timeSeries || []);
      const firmaData = analyticsRes.data.firma?.data || [];
      const lagerData = analyticsRes.data.lager?.data || [];
      setFirmaStats(firmaData.filter((f) => f.total_sum > 0));
      setLagerStats(lagerData.filter((l) => l.total_sum > 0));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        {/* System status */}
        <div className="card bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-700/50">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Ordrer i DB</span>
            <span className="stat-value">{formatNumberNb(status?.tables?.orders || 0)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Kunder i DB</span>
            <span className="stat-value">{formatNumberNb(status?.tables?.customers || 0)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Produkter i DB</span>
            <span className="stat-value">{formatNumberNb(status?.tables?.products || 0)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Brukere i DB</span>
            <span className="stat-value">{formatNumberNb(status?.tables?.users || 0)}</span>
          </div>
        </div>

        {/* Stats cards row 2 - Business metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card gradient-primary text-white">
            <span className="stat-label text-white/80">Total Omsetning</span>
            <span className="stat-value text-2xl">
              {formatCurrencyNok(summary?.totalRevenue || 0)}
            </span>
          </div>
          <div className="stat-card gradient-success text-white">
            <span className="stat-label text-white/80">Totale Ordrer</span>
            <span className="stat-value">{formatNumberNb(summary?.totalOrders || 0)}</span>
          </div>
          <div className="stat-card gradient-warning text-white">
            <span className="stat-label text-white/80">Aktive Kunder</span>
            <span className="stat-value">{formatNumberNb(summary?.activeCustomers || 0)}</span>
          </div>
          <div className="stat-card gradient-danger text-white">
            <span className="stat-label text-white/80">Produkter Solgt</span>
            <span className="stat-value">{formatNumberNb(summary?.productsOrdered || 0)}</span>
          </div>
        </div>

        {/* NEW: Widget row - Top Products, Top Customers, Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopProductsWidget data={widgets?.topProducts || []} isLoading={!widgets} />
          <TopCustomersWidget data={widgets?.topCustomers || []} isLoading={!widgets} />
          <QuickActionsWidget />
        </div>

        {/* NEW: Widget row - Price Deviations and Data Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PriceDeviationsWidget data={widgets?.priceDeviations || []} isLoading={!widgets} />
          <DataStatusWidget data={widgets?.recentActivity || null} isLoading={!widgets} />
        </div>

        {/* Export button */}
        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="admin-dashboard" />
        </div>

        {/* Charts */}
        <div ref={chartRef} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <LineChart
                data={timeSeries}
                xKey="period"
                yKey="total_sum"
                title="📈 Omsetning over tid"
                color="#10b981"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
              />
            </div>
            <div className="card">
              <BarChart
                data={timeSeries}
                xKey="period"
                yKey="order_count"
                title="📊 Ordrer per måned"
                color="#8b5cf6"
                seriesName="Antall Ordrer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <PieChart
                data={firmaStats}
                nameKey="firmanavn"
                valueKey="total_sum"
                title="🏢 Omsetning per Firma"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
              />
            </div>
            <div className="card">
              <BarChart
                data={lagerStats}
                xKey="lagernavn"
                yKey="total_sum"
                title="📦 Omsetning per Lager"
                color="#f59e0b"
                seriesName="Omsetning"
                valueFormatter={formatCurrencyNok}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

