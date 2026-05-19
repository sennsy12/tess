import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
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
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { useSavedViews } from '../../hooks/useSavedViews';
import { StatsFilters } from './statistics/components/StatsFilters';
import { StatsCharts } from './statistics/components/StatsCharts';
import { StatsTable } from './statistics/components/StatsTable';
import { StatType, ComparisonData } from '../../types/statistics';

type StatRow = KundeStats | VaregruppeStats | VareStats | LagerStats | FirmaStats;

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
    description: 'Vis omsetning per kunde for de siste 30 dagene',
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
    description: 'Analyser varegrupper siste 30 dager',
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
    description: 'Slå på periode-sammenligning for siste 30 dager',
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

export interface StatisticsPageProps {
  pageTitle?: string;
  savedViewsScope?: string;
  enableSharedViews?: boolean;
}

export function StatisticsPage({
  pageTitle = 'Statistikk',
  savedViewsScope = 'admin-statistics',
  enableSharedViews = true,
}: StatisticsPageProps) {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filters, setFilters] = useState({ kundenr: '', varegruppe: '' });
  const [compareEnabled, setCompareEnabled] = useState(false);
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

  const workspaceState = {
    statType,
    dateRange,
    filters,
    compareEnabled,
  };

  const {
    views,
    defaultView,
    canUseShared,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: savedViewsScope,
    state: workspaceState,
    enabledShared: enableSharedViews,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    setStatType(defaultView.state.statType);
    setDateRange(defaultView.state.dateRange);
    setFilters(defaultView.state.filters);
    setCompareEnabled(defaultView.state.compareEnabled);
    setPage(1);
  }, [defaultView]);

  const applyPreset = (presetId: string) => {
    const preset = STATISTICS_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const next = preset.apply();
    setStatType(next.statType);
    setDateRange(next.dateRange);
    setFilters(next.filters);
    setCompareEnabled(next.compareEnabled);
    setPage(1);
  };

  const isKundeScope = savedViewsScope.startsWith('kunde');

  return (
    <Layout title={pageTitle}>
      <Breadcrumb
        items={[
          { label: isKundeScope ? 'Hjem' : 'Dashboard', to: isKundeScope ? '/kunde' : '/admin' },
          { label: 'Statistikk' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filters & Saved Reports */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card">
            <div className="mb-4">
              <h3 className="font-semibold text-lg">Anbefalte analyser</h3>
              <p className="text-sm text-dark-400 mt-1">Start raskt med ferdige oppsett for de vanligste spørsmålene.</p>
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
            setStatType={handleStatTypeChange}
            dateRange={dateRange}
            setDateRange={handleDateRangeChange}
            filters={filters}
            setFilters={handleFiltersChange}
            compareEnabled={compareEnabled}
            setCompareEnabled={setCompareEnabled}
            chartRef={chartRef}
          />

          <SavedViewsPanel
            title="Lagrede arbeidsflater"
            description="Lagre filtre og sammenligninger, og del visninger med andre administratorer."
            views={views}
            isLoading={viewsLoading}
            canShare={canUseShared}
            onApply={(view) => {
              setStatType(view.state.statType);
              setDateRange(view.state.dateRange);
              setFilters(view.state.filters);
              setCompareEnabled(view.state.compareEnabled);
              setPage(1);
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

export function AdminStatistics() {
  return (
    <StatisticsPage
      pageTitle="Admin Statistikk"
      savedViewsScope="admin-statistics"
      enableSharedViews
    />
  );
}
