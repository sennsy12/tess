import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '../../components/EmptyState';
import { EmptyData } from '../../components/emptyStates/EmptyIllustrations';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { QueryRefetchBar } from '../../components/QueryRefetchBar';
import { statisticsKeys } from '../../lib/queryKeys';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { statisticsApi, StatisticsSummary } from '../../lib/api';
import { getApiError } from '../../lib/apiErrors';
import { reportError } from '../../lib/observability';
import { formatCurrencyNok } from '../../lib/formatters';
import { ChartSkeleton, TableSkeleton } from '../../components/admin';
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { useSavedViews } from '../../hooks/useSavedViews';
import { StatsFilters, StatsCharts, StatsTable, StatsKpiStrip, StatsPresetChips } from './components';
import { StatType, ComparisonData } from '../../types/statistics';
import { STATISTICS_PRESETS } from './statisticsPresets';
import {
  fetchStatData,
  getNameKey,
  getPreviousRange,
  getSavedViewsDescription,
  getStatisticsHome,
  getTitle,
} from './statisticsUtils';

export interface StatisticsPageProps {
  pageTitle?: string;
  savedViewsScope?: string;
  enableSharedViews?: boolean;
  exportFilenamePrefix?: string;
  savedViewsDescription?: string;
}

/**
 * Layout (top to bottom):
 *   [ KPI-strip: periodens nøkkeltall ]
 *   [ Verktøylinje: gruppe / periode / filtre / sammenligning / eksport ]
 *   [ Anbefalte analyser (chips) ]
 *   [ Grafer + detaljtabell ]
 *   [ Lagrede arbeidsflater ]
 */
export function StatisticsPage({
  pageTitle = 'Statistikk',
  savedViewsScope = 'admin-statistics',
  enableSharedViews = true,
  exportFilenamePrefix = 'statistikk',
  savedViewsDescription,
}: StatisticsPageProps) {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [filters, setFilters] = useState({ kundenr: '', varegruppe: '' });
  const [compareEnabled, setCompareEnabled] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const hasAppliedDefaultView = useRef(false);

  const { data: statsResult, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: statisticsKeys.list(savedViewsScope, statType, page, dateRange, filters),
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
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (isError && error) {
      reportError(error, { source: 'statistics-list', scope: savedViewsScope });
    }
  }, [isError, error, savedViewsScope]);

  // Period summary powers the KPI strip; fetched for the selected range
  // regardless of comparison being enabled.
  const { data: currentSummary, isLoading: summaryLoading } = useQuery({
    queryKey: statisticsKeys.summary(savedViewsScope, dateRange),
    queryFn: async (): Promise<StatisticsSummary> => {
      const response = await statisticsApi.summary({
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      });
      return response.data as StatisticsSummary;
    },
    placeholderData: (prev) => prev,
  });

  const data = statsResult?.data ?? [];
  const pagination = statsResult?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 };
  const showRefetchBar = isFetching && !!statsResult && !isError;
  const statsErrorMessage = isError ? getApiError(error, 'Kunne ikke laste statistikk') : null;

  const { data: comparison = null } = useQuery({
    // Include current total in key so delta recomputes when summary arrives
    // after date-range change (previously stale until next range edit).
    queryKey: [...statisticsKeys.comparison(savedViewsScope, dateRange, compareEnabled), currentSummary?.totalRevenue ?? 0],
    queryFn: async (): Promise<ComparisonData | null> => {
      if (!compareEnabled || !dateRange.startDate || !dateRange.endDate) return null;
      const prevRange = getPreviousRange(dateRange.startDate, dateRange.endDate);
      const previousRes = await statisticsApi.summary({
        startDate: prevRange.startDate,
        endDate: prevRange.endDate,
      });
      const currentTotal = currentSummary?.totalRevenue ?? 0;
      const previousTotal = (previousRes.data as StatisticsSummary).totalRevenue || 0;
      const deltaPercent = previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100;
      return { currentTotal, previousTotal, deltaPercent };
    },
    enabled: compareEnabled && !!dateRange.startDate && !!dateRange.endDate,
  });

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowClick = useCallback(
    (row: object) => {
      const record = row as Record<string, unknown>;
      if (statType === 'varegruppe' && record.varegruppe) {
        setFilters((prev) => ({ ...prev, varegruppe: String(record.varegruppe) }));
        setStatType('vare');
        setPage(1);
      } else if (statType === 'kunde' && record.kundenr) {
        setFilters((prev) => ({ ...prev, kundenr: String(record.kundenr) }));
        setStatType('vare');
        setPage(1);
      }
    },
    [statType],
  );

  const handleStatTypeChange = useCallback((newType: StatType) => {
    setStatType(newType);
    setPage(1);
  }, []);

  const handleDateRangeChange = useCallback((newRange: typeof dateRange) => {
    setDateRange(newRange);
    setPage(1);
  }, []);

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

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

  const applyPreset = useCallback((presetId: string) => {
    const preset = STATISTICS_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const next = preset.apply();
    setStatType(next.statType);
    setDateRange(next.dateRange);
    setFilters(next.filters);
    setCompareEnabled(next.compareEnabled);
    setPage(1);
  }, []);

  const home = getStatisticsHome(savedViewsScope);
  const viewsDescription =
    savedViewsDescription ?? getSavedViewsDescription(savedViewsScope, enableSharedViews);

  return (
    <Layout title={pageTitle}>
      <Breadcrumb
        items={[
          { label: home.label, to: home.to },
          { label: 'Statistikk' },
        ]}
      />
      <div className="space-y-6">
        <StatsKpiStrip
          summary={currentSummary}
          comparison={comparison}
          compareEnabled={compareEnabled}
          isLoading={summaryLoading}
        />

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
          exportFilenamePrefix={exportFilenamePrefix}
        />

        <StatsPresetChips
          statType={statType}
          dateRange={dateRange}
          filters={filters}
          compareEnabled={compareEnabled}
          onApply={applyPreset}
        />

        {isLoading ? (
          <div className="space-y-6">
            <ChartSkeleton height="h-72" />
            <div className="card p-0 lg:p-0 overflow-hidden">
              <TableSkeleton rows={8} columns={4} />
            </div>
          </div>
        ) : isError ? (
          <QueryErrorBanner
            message={statsErrorMessage ?? 'Kunne ikke laste statistikk'}
            onRetry={() => void refetch()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            illustration={<EmptyData />}
            title="Ingen data for valgt periode og filtre"
            description="Prøv å utvide perioden eller fjerne filtre for å se statistikk."
          />
        ) : (
          <div ref={chartRef} className="space-y-6">
            {showRefetchBar && <QueryRefetchBar active />}
            <StatsCharts
              data={data}
              nameKey={getNameKey(statType)}
              title={getTitle(statType)}
              currencyFormatter={formatCurrencyNok}
            />

            <StatsTable
              data={data}
              nameKey={getNameKey(statType)}
              title={getTitle(statType)}
              currencyFormatter={formatCurrencyNok}
              pagination={pagination}
              onPageChange={handlePageChange}
              isLoading={isLoading}
              onRowClick={handleRowClick}
            />
          </div>
        )}

        <SavedViewsPanel
          title="Lagrede arbeidsflater"
          description={viewsDescription}
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
    </Layout>
  );
}
