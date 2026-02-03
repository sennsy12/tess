import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { ExportButton } from '../../components/ExportButton';
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

export function AnalyseDashboard() {
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [kundeStats, setKundeStats] = useState<KundeStats[]>([]);
  const [varegruppeStats, setVaregruppeStats] = useState<VaregruppeStats[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const batchRes = await statisticsApi.batch({ groupBy: 'month' });
      const { summary, kunde, varegruppe, timeSeries } = batchRes.data;

      setSummary(summary);
      const kundeData = kunde?.data || [];
      const varegruppeData = varegruppe?.data || [];
      setKundeStats(kundeData.filter((k) => k.total_sum > 0).slice(0, 10));
      setVaregruppeStats(varegruppeData.filter((v) => v.total_sum > 0));
      setTimeSeries(timeSeries || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout title="Analyse Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

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
