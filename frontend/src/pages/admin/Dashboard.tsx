import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { statisticsApi, statusApi } from '../../lib/api';

export function AdminDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [firmaStats, setFirmaStats] = useState<any[]>([]);
  const [lagerStats, setLagerStats] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load status first and independently
      try {
        const statusRes = await statusApi.getStatus();
        setStatus(statusRes.data);
      } catch (error) {
        console.error('Failed to load system status:', error);
      }

      // Load statistics
      const [summaryRes, timeSeriesRes, firmaRes, lagerRes] = await Promise.all([
        statisticsApi.summary(),
        statisticsApi.timeSeries({ groupBy: 'month' }),
        statisticsApi.byFirma(),
        statisticsApi.byLager(),
      ]);

      setSummary(summaryRes.data);
      setTimeSeries(timeSeriesRes.data);
      setFirmaStats(firmaRes.data.filter((f: any) => f.total_sum > 0));
      setLagerStats(lagerRes.data.filter((l: any) => l.total_sum > 0));
    } catch (error) {
      console.error('Failed to load statistics:', error);
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

  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

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

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Ordrer i DB</span>
            <span className="stat-value">{status?.tables?.orders || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Kunder i DB</span>
            <span className="stat-value">{status?.tables?.customers || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Produkter i DB</span>
            <span className="stat-value">{status?.tables?.products || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Brukere i DB</span>
            <span className="stat-value">{status?.tables?.users || 0}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="stat-card gradient-primary text-white">
            <span className="stat-label text-white/80">Total Omsetning</span>
            <span className="stat-value text-2xl">
              {currencyFormatter(summary?.totalRevenue || 0)}
            </span>
          </div>
          <div className="stat-card gradient-success text-white">
            <span className="stat-label text-white/80">Totale Ordrer</span>
            <span className="stat-value">{summary?.totalOrders || 0}</span>
          </div>
          <div className="stat-card gradient-warning text-white">
            <span className="stat-label text-white/80">Aktive Kunder</span>
            <span className="stat-value">{summary?.activeCustomers || 0}</span>
          </div>
          <div className="stat-card gradient-danger text-white">
            <span className="stat-label text-white/80">Produkter Solgt</span>
            <span className="stat-value">{summary?.productsOrdered || 0}</span>
          </div>
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
                valueFormatter={currencyFormatter}
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
                valueFormatter={currencyFormatter}
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
                valueFormatter={currencyFormatter}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
