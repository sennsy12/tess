import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import {
  statisticsApi,
  PaginatedResponse,
  KundeStats,
  VaregruppeStats,
  VareStats,
  LagerStats,
  FirmaStats,
  StatisticsSummary,
} from '../../lib/api';
import { formatCurrencyNok } from '../../lib/formatters';
import { ChartSkeleton, TableSkeleton } from '../../components/admin';
import { SavedReportsList } from '../../components/SavedReportsList';
import { StatsFilters } from './statistics/components/StatsFilters';
import { StatsCharts } from './statistics/components/StatsCharts';
import { StatsTable } from './statistics/components/StatsTable';

type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';
type StatRow = KundeStats | VaregruppeStats | VareStats | LagerStats | FirmaStats;

interface ComparisonData {
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export function AdminStatistics() {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filters, setFilters] = useState({ kundenr: '', varegruppe: '' });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const getPreviousRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const prevStart = new Date(prevEnd.getTime() - diff);
    return { startDate: formatDate(prevStart), endDate: formatDate(prevEnd) };
  };

  const fetchStatData = async (statType: StatType, params: any) => {
    let response;
    switch (statType) {
      case 'kunde':
        response = await statisticsApi.byKunde(params);
        break;
      case 'varegruppe':
        response = await statisticsApi.byVaregruppe(params);
        break;
      case 'vare':
        response = await statisticsApi.byVare(params);
        break;
      case 'lager':
        response = await statisticsApi.byLager(params);
        break;
      case 'firma':
        response = await statisticsApi.byFirma(params);
        break;
    }
    return response?.data as PaginatedResponse<StatRow>;
  };

  const { data: statsResult, isLoading } = useQuery({
    queryKey: ['admin', 'statistics', statType, page, dateRange, filters],
    queryFn: () => {
      const params = {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        kundenr: filters.kundenr || undefined,
        varegruppe: filters.varegruppe || undefined,
        page,
        limit: 25,
      };
      return fetchStatData(statType, params);
    },
  });

  const data = statsResult?.data ?? [];
  const pagination = statsResult?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 };

  const { data: comparison = null } = useQuery({
    queryKey: ['admin', 'statistics', 'comparison', dateRange, compareEnabled],
    queryFn: async (): Promise<ComparisonData | null> => {
      if (!compareEnabled || !dateRange.startDate || !dateRange.endDate) return null;
      const currentRes = await statisticsApi.summary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const prevRange = getPreviousRange(dateRange.startDate, dateRange.endDate);
      const previousRes = await statisticsApi.summary({
        startDate: prevRange.startDate,
        endDate: prevRange.endDate,
      });
      const currentTotal = (currentRes.data as StatisticsSummary).totalRevenue || 0;
      const previousTotal = (previousRes.data as StatisticsSummary).totalRevenue || 0;
      const deltaPercent = previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;
      return { currentTotal, previousTotal, deltaPercent };
    },
    enabled: compareEnabled && !!dateRange.startDate && !!dateRange.endDate,
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleRowClick = (row: any) => {
    if (statType === 'varegruppe' && row.varegruppe) {
      setFilters({ ...filters, varegruppe: row.varegruppe });
      setStatType('vare');
      setPage(1);
    } else if (statType === 'kunde' && row.kundenr) {
      setFilters({ ...filters, kundenr: row.kundenr });
      setStatType('vare');
      setPage(1);
    }
  };

  const getNameKey = () => {
    switch (statType) {
      case 'kunde': return 'kundenavn';
      case 'varegruppe': return 'varegruppe';
      case 'vare': return 'varenavn';
      case 'lager': return 'lagernavn';
      case 'firma': return 'firmanavn';
    }
  };

  const getTitle = () => {
    switch (statType) {
      case 'kunde': return 'Statistikk per Kunde';
      case 'varegruppe': return 'Statistikk per Varegruppe';
      case 'vare': return 'Statistikk per Vare';
      case 'lager': return 'Statistikk per Lager';
      case 'firma': return 'Statistikk per Firma';
    }
  };

  const handleLoadReport = (config: any) => {
    if (config.statType) setStatType(config.statType);
    if (config.startDate !== undefined) setDateRange(prev => ({ ...prev, startDate: config.startDate }));
    if (config.endDate !== undefined) setDateRange(prev => ({ ...prev, endDate: config.endDate }));
    if (config.kundenr !== undefined) setFilters(prev => ({ ...prev, kundenr: config.kundenr }));
    if (config.varegruppe !== undefined) setFilters(prev => ({ ...prev, varegruppe: config.varegruppe }));
    setPage(1);
  };

  // Reset page to 1 when filters change - handled via setters above
  const handleStatTypeChange = (newType: StatType) => {
    setStatType(newType);
    setPage(1);
  };

  const handleDateRangeChange = (newRange: typeof dateRange) => {
    setDateRange(newRange);
    setPage(1);
  };

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const currentConfig = {
    statType,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    kundenr: filters.kundenr,
    varegruppe: filters.varegruppe,
  };

  return (
    <Layout title="Admin Statistikk">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filters & Saved Reports */}
        <div className="space-y-6 lg:col-span-1">
          <StatsFilters
            statType={statType}
            setStatType={handleStatTypeChange}
            dateRange={dateRange}
            setDateRange={handleDateRangeChange}
            filters={filters}
            setFilters={handleFiltersChange}
            compareEnabled={compareEnabled}
            setCompareEnabled={setCompareEnabled}
            chartRef={chartRef}
          />

          <SavedReportsList 
            onLoad={handleLoadReport} 
            currentConfig={currentConfig} 
          />
        </div>

        {/* Right Column: Charts & Data */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <ChartSkeleton height="h-72" />
              <div className="card p-0 lg:p-0 overflow-hidden">
                <TableSkeleton rows={8} columns={6} />
              </div>
            </div>
          ) : (
            <div ref={chartRef} className="space-y-6">
              <StatsCharts
                data={data}
                nameKey={getNameKey()}
                title={getTitle()}
                currencyFormatter={formatCurrencyNok}
                comparison={comparison}
              />

              <StatsTable
                data={data}
                nameKey={getNameKey()}
                title={getTitle()}
                currencyFormatter={formatCurrencyNok}
                pagination={pagination}
                onPageChange={handlePageChange}
                isLoading={isLoading}
                onRowClick={handleRowClick}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
