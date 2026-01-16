import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { ExportButton } from '../../components/ExportButton';
import { statisticsApi } from '../../lib/api';
import { DashboardStats } from './components/DashboardStats';
import { TopCustomerCard } from './components/TopCustomerCard';
import { DashboardCharts } from './components/DashboardCharts';

export function AnalyseDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [kundeStats, setKundeStats] = useState<any[]>([]);
  const [varegruppeStats, setVaregruppeStats] = useState<any[]>([]);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [summaryRes, kundeRes, varegruppeRes, timeSeriesRes] = await Promise.all([
        statisticsApi.summary(),
        statisticsApi.byKunde(),
        statisticsApi.byVaregruppe(),
        statisticsApi.timeSeries({ groupBy: 'month' }),
      ]);

      setSummary(summaryRes.data);
      setKundeStats(kundeRes.data.filter((k: any) => k.total_sum > 0).slice(0, 10));
      setVaregruppeStats(varegruppeRes.data.filter((v: any) => v.total_sum > 0));
      setTimeSeries(timeSeriesRes.data);
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

  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  return (
    <Layout title="Analyse Dashboard">
      <div className="space-y-6">
        <DashboardStats summary={summary} currencyFormatter={currencyFormatter} />

        <TopCustomerCard topCustomer={summary?.topCustomer} currencyFormatter={currencyFormatter} />

        <div className="flex justify-end">
          <ExportButton targetRef={chartRef} filename="analyse-dashboard" />
        </div>

        <div ref={chartRef}>
          <DashboardCharts
            timeSeries={timeSeries}
            kundeStats={kundeStats}
            varegruppeStats={varegruppeStats}
            currencyFormatter={currencyFormatter}
          />
        </div>
      </div>
    </Layout>
  );
}
