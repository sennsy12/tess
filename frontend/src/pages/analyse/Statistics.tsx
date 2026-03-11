import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { Skeleton } from '../../components/Skeleton';
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
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { useSavedViews } from '../../hooks/useSavedViews';
import { StatsFilters } from './components/StatsFilters';
import { StatsCharts } from './components/StatsCharts';
import { StatsTable } from './components/StatsTable';

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

const TODAY = new Date();
const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const shiftDays = (days: number) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return toDateInput(date);
};

const STATISTICS_PRESETS = [
  {
    id: 'monthly-revenue',
    label: 'Månedlig omsetning',
    description: 'Vis kundestatistikk for de siste 30 dagene',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDays(29), endDate: toDateInput(TODAY) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'top-customers-quarter',
    label: 'Toppkunder dette kvartalet',
    description: 'Ranger kunder i innevarende kvartal',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDays(89), endDate: toDateInput(TODAY) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'products-by-category',
    label: 'Produkter per kategori',
    description: 'Se varegrupper og omsetning siste 30 dager',
    apply: () => ({
      statType: 'varegruppe' as StatType,
      dateRange: { startDate: shiftDays(29), endDate: toDateInput(TODAY) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'compare-periods',
    label: 'Sammenlign med forrige periode',
    description: 'Aktiver sammenligning for siste 30 dager',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDays(29), endDate: toDateInput(TODAY) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: true,
    }),
  },
  {
    id: 'warehouse-trend',
    label: 'Lagertrend',
    description: 'Se omsetning per lager siste 90 dager',
    apply: () => ({
      statType: 'lager' as StatType,
      dateRange: { startDate: shiftDays(89), endDate: toDateInput(TODAY) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
];

export function AnalyseStatistics() {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [data, setData] = useState<StatRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filters, setFilters] = useState({ kundenr: '', varegruppe: '' });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const hasAppliedDefaultView = useRef(false);

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

  const workspaceState = {
    statType,
    dateRange,
    filters,
    compareEnabled,
  };

  const {
    views,
    defaultView,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: 'analyse-statistics',
    state: workspaceState,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    setStatType(defaultView.state.statType);
    setDateRange(defaultView.state.dateRange);
    setFilters(defaultView.state.filters);
    setCompareEnabled(defaultView.state.compareEnabled);
  }, [defaultView]);

  const applyPreset = (presetId: string) => {
    const preset = STATISTICS_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const next = preset.apply();
    setStatType(next.statType);
    setDateRange(next.dateRange);
    setFilters(next.filters);
    setCompareEnabled(next.compareEnabled);
  };

  return (
    <Layout title="Detaljert Statistikk">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Left Column: Filters & Saved Reports */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card">
            <div className="mb-4">
              <h3 className="font-semibold text-lg">Anbefalte analyser</h3>
              <p className="text-sm text-dark-400 mt-1">Bruk ferdige oppsett for vanlige analyser og sammenligninger.</p>
            </div>
            <div className="space-y-2">
              {STATISTICS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="w-full rounded-xl border border-dark-700 bg-dark-800/40 px-4 py-3 text-left transition-colors hover:bg-dark-800/80"
                >
                  <p className="font-medium text-dark-100">{preset.label}</p>
                  <p className="text-sm text-dark-400 mt-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

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

          <SavedViewsPanel
            title="Lagrede arbeidsflater"
            description="Lagre statistikkoppsett og bruk dem igjen med ett klikk."
            views={views}
            isLoading={viewsLoading}
            onApply={(view) => {
              setStatType(view.state.statType);
              setDateRange(view.state.dateRange);
              setFilters(view.state.filters);
              setCompareEnabled(view.state.compareEnabled);
            }}
            onSave={(name, options) => saveView(name, options)}
            onDelete={(view) => deleteView(view)}
            onSetDefault={setDefaultView}
          />
        </div>

        {/* Right Column: Charts & Data */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Skeleton className="h-[400px] w-full" />
                <Skeleton className="h-[400px] w-full" />
              </div>
              <Skeleton className="h-[600px] w-full" />
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
      </motion.div>
    </Layout>
  );
}
