import { useEffect, useState, useRef } from 'react';
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
import { SavedReportsList } from '../../components/SavedReportsList';
import { StatsFilters } from './statistics/components/StatsFilters';
import { StatsCharts } from './statistics/components/StatsCharts';
import { StatsTable } from './statistics/components/StatsTable';

type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';
type StatRow = KundeStats | VaregruppeStats | VareStats | LagerStats | FirmaStats;

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ComparisonData {
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export function AdminStatistics() {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [data, setData] = useState<StatRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filters, setFilters] = useState({ kundenr: '', varegruppe: '' });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
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

  useEffect(() => {
    loadData(1); // Reset to page 1 when filters change
  }, [statType, dateRange, filters]);

  useEffect(() => {
    const loadComparison = async () => {
      if (!compareEnabled || !dateRange.startDate || !dateRange.endDate) {
        setComparison(null);
        return;
      }
      try {
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
        setComparison({ currentTotal, previousTotal, deltaPercent });
      } catch (error) {
        setComparison(null);
      }
    };
    loadComparison();
  }, [compareEnabled, dateRange.startDate, dateRange.endDate]);

  const loadData = async (page: number = 1) => {
    setIsLoading(true);
    try {
      const params = {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        kundenr: filters.kundenr || undefined,
        varegruppe: filters.varegruppe || undefined,
        page,
        limit: 25,
      };

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
      
      const result = response?.data as PaginatedResponse<StatRow>;
      setData(result?.data || []);
      setPagination(result?.pagination || { page: 1, limit: 25, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    loadData(newPage);
  };

  const handleRowClick = (row: any) => {
    if (statType === 'varegruppe' && row.varegruppe) {
      setFilters({ ...filters, varegruppe: row.varegruppe });
      setStatType('vare');
    } else if (statType === 'kunde' && row.kundenr) {
      setFilters({ ...filters, kundenr: row.kundenr });
      setStatType('vare');
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
            setStatType={setStatType}
            dateRange={dateRange}
            setDateRange={setDateRange}
            filters={filters}
            setFilters={setFilters}
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
            <div className="flex items-center justify-center h-64 card">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
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
