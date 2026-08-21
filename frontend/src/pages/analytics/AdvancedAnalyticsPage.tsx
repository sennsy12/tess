import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import { formatCurrencyNok, formatNumberNb } from '../../lib/formatters';
import { useSavedViews } from '../../hooks/useSavedViews';
import { AnalyticsChartArea } from './AnalyticsChartArea';
import { AnalyticsKpiStrip } from './AnalyticsKpiStrip';
import { AnalyticsPresetChips } from './AnalyticsPresetChips';
import { AnalyticsToolbar } from './AnalyticsToolbar';
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { createDefaultAnalyticsConfig } from './analyticsDefaults';
import { useAnalyticsQuery } from './useAnalyticsQuery';
import type { AdvancedAnalyticsPageProps, AnalyticsConfig } from './analyticsTypes';

/**
 * Layout (desktop):
 *   [ KPI-strip ]
 *   [ Verktøylinje ]
 *   [ Anbefalte analyser (chips) ]
 *   [ Graf + detaljer (3/4) | Lagrede visninger (1/4) ]
 *
 * On mobile everything stacks in the same order, so the chart appears
 * before the saved-views panel.
 */
export function AdvancedAnalyticsPage({
  title,
  scope,
  presets,
  exportFilenamePrefix,
  savedViewsTitle,
  savedViewsDescription,
  enableSharedViews = false,
}: AdvancedAnalyticsPageProps) {
  const [config, setConfig] = useState<AnalyticsConfig>(createDefaultAnalyticsConfig);
  const [detailsPage, setDetailsPage] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  const hasAppliedDefaultView = useRef(false);

  const {
    views,
    defaultView,
    canUseShared,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope,
    state: config,
    enabledShared: enableSharedViews,
  });

  useEffect(() => {
    setDetailsPage(1);
  }, [config.metric, config.dimension, config.startDate, config.endDate, config.search]);

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    setConfig(defaultView.state);
  }, [defaultView]);

  const { data = [], isLoading, isError, refetch } = useAnalyticsQuery(scope, config);

  const valueFormatter = useMemo(
    () => (config.metric === 'sum' ? formatCurrencyNok : formatNumberNb),
    [config.metric],
  );

  return (
    <Layout title={title}>
      <div className="space-y-6">
        <AnalyticsKpiStrip data={data} isLoading={isLoading} valueFormatter={valueFormatter} />

        <AnalyticsToolbar
          config={config}
          onConfigChange={setConfig}
          chartRef={chartRef}
          exportFilenamePrefix={exportFilenamePrefix}
        />

        <AnalyticsPresetChips presets={presets} config={config} onApply={setConfig} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <AnalyticsChartArea
            config={config}
            data={data}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            valueFormatter={valueFormatter}
            chartRef={chartRef}
            detailsPage={detailsPage}
            onDetailsPageChange={setDetailsPage}
          />

          <aside className="lg:col-span-1 min-w-0" aria-label={savedViewsTitle}>
            <SavedViewsPanel
              title={savedViewsTitle}
              description={savedViewsDescription}
              views={views}
              isLoading={viewsLoading}
              canShare={canUseShared}
              onApply={(view) => setConfig(view.state)}
              onSave={(name, options) => saveView(name, options)}
              onDelete={(view) => deleteView(view)}
              onSetDefault={setDefaultView}
            />
          </aside>
        </div>
      </div>
    </Layout>
  );
}
