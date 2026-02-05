import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { statisticsApi, ordersApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export function KundeDashboard() {
  const { user } = useAuth();
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: summary } = useQuery({
    queryKey: ['kunde', 'summary'],
    queryFn: () => statisticsApi.summary().then(res => res.data),
  });

  const { data: recentOrders = [] } = useQuery({
    queryKey: ['kunde', 'recentOrders'],
    queryFn: async () => {
      const res = await ordersApi.getAll();
      const ordersData = res.data?.data || res.data || [];
      return ordersData.slice(0, 5);
    },
  });

  const { data: varegruppeStats = [] } = useQuery({
    queryKey: ['kunde', 'varegruppeStats'],
    queryFn: async () => {
      const res = await statisticsApi.byVaregruppe();
      return res.data?.data || res.data || [];
    },
  });

  const { data: timeSeries = [], isLoading } = useQuery({
    queryKey: ['kunde', 'timeSeries'],
    queryFn: () => statisticsApi.timeSeries({ groupBy: 'month' }).then(res => res.data),
  });

  if (isLoading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  return (
    <Layout title="Kunde Dashboard">
      <div className="space-y-6">
        {/* Welcome message */}
        <div className="card bg-gradient-to-r from-primary-600/20 to-primary-800/20 border-primary-700/50">
          <h3 className="text-xl font-semibold text-dark-50">
            Velkommen, {user?.kundenr || user?.username}! 👋
          </h3>
          <p className="text-dark-300 mt-1">
            Her er en oversikt over dine ordrer og statistikk.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <span className="stat-label">Totale Ordrer</span>
            <span className="stat-value">{summary?.totalOrders || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Omsetning</span>
            <span className="stat-value">
              {currencyFormatter(summary?.totalRevenue || 0)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Produkter Bestilt</span>
            <span className="stat-value">{summary?.productsOrdered || 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Gjennomsnitt/Ordre</span>
            <span className="stat-value">
              {currencyFormatter((summary?.totalRevenue || 0) / Math.max(summary?.totalOrders || 1, 1))}
            </span>
          </div>
        </div>

        {/* Export button */}
        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="kunde-dashboard" />
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
                  <tr key={order.ordrenr} className="hover:bg-dark-800/30">
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
