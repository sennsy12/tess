import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ExportButton } from '../../components/ExportButton';
import { ChartSkeleton, StatCardSkeleton } from '../../components/Skeleton';
import {
  statisticsApi,
  StatisticsSummary,
  KundeStats,
  VaregruppeStats,
  TimeSeriesPoint,
} from '../../lib/api';
import { formatCurrencyNok } from '../../lib/formatters';
import { DashboardStats } from './components/DashboardStats';
import { TopCustomerCard } from './components/TopCustomerCard';
import { DashboardCharts } from './components/DashboardCharts';

interface AnalyseDashboardData {
  summary: StatisticsSummary | null;
  kundeStats: KundeStats[];
  varegruppeStats: VaregruppeStats[];
  timeSeries: TimeSeriesPoint[];
}

export function AnalyseDashboard() {
  const chartRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useQuery<AnalyseDashboardData>({
    queryKey: ['analyse-dashboard'],
    queryFn: async () => {
      const batchRes = await statisticsApi.batch({ groupBy: 'month' });
      const { summary, kunde, varegruppe, timeSeries } = batchRes.data;
      const kundeData = kunde?.data || [];
      const varegruppeData = varegruppe?.data || [];

      return {
        summary: summary ?? null,
        kundeStats: kundeData.filter((k) => k.total_sum > 0).slice(0, 10),
        varegruppeStats: varegruppeData.filter((v) => v.total_sum > 0),
        timeSeries: timeSeries || [],
      };
    },
  });

  if (isLoading) {
    return (
      <Layout title="Analyse Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
          <div className="card">
            <div className="space-y-3">
              <div className="h-4 w-32 bg-dark-700/60 animate-pulse rounded" />
              <div className="h-8 w-48 bg-dark-700/60 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  if (isError) {
    return (
      <Layout title="Analyse Dashboard">
        <div className="card text-dark-300">
          Klarte ikke laste analysedashboard akkurat nå.
        </div>
      </Layout>
    );
  }

  const summary = data?.summary ?? null;
  const kundeStats = data?.kundeStats ?? [];
  const varegruppeStats = data?.varegruppeStats ?? [];
  const timeSeries = data?.timeSeries ?? [];

  return (
    <Layout title="Analyse Dashboard">
      <div className="space-y-6">
        <DashboardStats summary={summary} currencyFormatter={formatCurrencyNok} />

        <TopCustomerCard topCustomer={summary?.topCustomer} currencyFormatter={formatCurrencyNok} />

        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="analyse-dashboard" />
        </div>

        <div ref={chartRef}>
          <DashboardCharts
            timeSeries={timeSeries}
            kundeStats={kundeStats}
            varegruppeStats={varegruppeStats}
            currencyFormatter={formatCurrencyNok}
          />
        </div>
      </div>
    </Layout>
  );
}
