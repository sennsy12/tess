import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { statisticsApi, suggestionsApi } from '../../lib/api';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { ChartSkeleton, TableSkeleton } from '../../components/Skeleton';
import { Pagination } from '../../components/admin';
import { useSavedViews } from '../../hooks/useSavedViews';

type Metric = 'sum' | 'count' | 'quantity';
const DETAILS_PAGE_SIZE = 25;
type Dimension = 'day' | 'month' | 'year' | 'product' | 'category';
type ChartType = 'bar' | 'line' | 'pie';

interface AnalyticsDataPoint {
  label: string;
  value: number;
}

const TODAY = new Date();
const toDateInput = (date: Date) => date.toISOString().slice(0, 10);
const shiftDays = (days: number) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - days);
  return toDateInput(date);
};

const ANALYTICS_PRESETS = [
  {
    id: 'monthly-revenue',
    label: 'Månedlig omsetning',
    bestFor: 'Se total omsetning over tid',
    description: 'Omsetning per måned siste 12 måneder',
    config: {
      metric: 'sum' as Metric,
      dimension: 'month' as Dimension,
      chartType: 'line' as ChartType,
      startDate: shiftDays(364),
      endDate: toDateInput(TODAY),
      search: '',
    },
  },
  {
    id: 'products-by-category',
    label: 'Produkter per kategori',
    bestFor: 'Finn hvilke varegrupper som selger mest',
    description: 'Antall varer per varegruppe siste 30 dager',
    config: {
      metric: 'quantity' as Metric,
      dimension: 'category' as Dimension,
      chartType: 'bar' as ChartType,
      startDate: shiftDays(29),
      endDate: toDateInput(TODAY),
      search: '',
    },
  },
  {
    id: 'compare-this-month',
    label: 'Denne måneden dag for dag',
    bestFor: 'Oppdage daglige topper og daler',
    description: 'Følg omsetning daglig for siste 30 dager',
    config: {
      metric: 'sum' as Metric,
      dimension: 'day' as Dimension,
      chartType: 'line' as ChartType,
      startDate: shiftDays(29),
      endDate: toDateInput(TODAY),
      search: '',
    },
  },
];

export function AdvancedAnalytics() {
  const [config, setConfig] = useState({
    metric: 'sum' as Metric,
    dimension: 'month' as Dimension,
    chartType: 'bar' as ChartType,
    startDate: '',
    endDate: '',
    search: '',
  });

  const [detailsPage, setDetailsPage] = useState(1);
  const chartRef = useRef<HTMLDivElement>(null);
  const hasAppliedDefaultView = useRef(false);

  useEffect(() => {
    setDetailsPage(1);
  }, [config.metric, config.dimension, config.startDate, config.endDate, config.search]);

  const {
    views,
    defaultView,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: 'kunde-advanced-analytics',
    state: config,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    setConfig(defaultView.state);
  }, [defaultView]);

  const {
    data = [],
    isLoading,
    isError,
  } = useQuery<AnalyticsDataPoint[]>({
    queryKey: [
      'kunde-advanced-analytics',
      config.metric,
      config.dimension,
      config.startDate,
      config.endDate,
      config.search,
    ],
    queryFn: async () => {
      const response = await statisticsApi.getCustom({
        metric: config.metric,
        dimension: config.dimension,
        startDate: config.startDate || undefined,
        endDate: config.endDate || undefined,
        search: config.search || undefined,
      });
      return response.data;
    },
  });

  const getMetricLabel = (m: Metric) => {
    switch (m) {
      case 'sum': return 'Omsetning (NOK)';
      case 'count': return 'Antall Ordrer';
      case 'quantity': return 'Antall Varer';
    }
  };

  const getDimensionLabel = (d: Dimension) => {
    switch (d) {
      case 'day': return 'Dag';
      case 'month': return 'Måned';
      case 'year': return 'År';
      case 'product': return 'Produkt';
      case 'category': return 'Varegruppe';
    }
  };


  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  const numberFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO').format(value);

  const valueFormatter = config.metric === 'sum' ? currencyFormatter : numberFormatter;

  return (
    <Layout title="Avansert Analyse">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6 min-w-0">
          <div className="card">
            <div className="mb-4">
              <h3 className="font-semibold text-lg">Anbefalte analyser</h3>
              <p className="text-sm text-dark-400 mt-1">Start raskt med ferdige oppsett for de vanligste spørsmålene.</p>
            </div>
            <div className="space-y-2">
              {ANALYTICS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setConfig(preset.config)}
                  className="w-full rounded-xl border border-dark-700 bg-dark-800/40 px-4 py-3 text-left transition-colors hover:bg-dark-800/80"
                >
                  <p className="font-medium text-dark-100">{preset.label}</p>
                  <p className="text-xs text-primary-400/90 mt-1">{preset.bestFor}</p>
                  <p className="text-sm text-dark-400 mt-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-visible">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg break-words">⚙️ Konfigurasjon</h3>
              <button
                onClick={() => setConfig({ metric: 'sum', dimension: 'month', chartType: 'bar', startDate: '', endDate: '', search: '' })}
                className="text-xs px-2 py-1 rounded border border-dark-600 hover:bg-dark-700 text-dark-300 hover:text-dark-100 transition-colors"
              >
                Nullstill
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Metric Selection */}
              <div className="min-w-0">
                <label className="label break-words">Hva vil du måle?</label>
                <select
                  value={config.metric}
                  onChange={(e) => setConfig({ ...config, metric: e.target.value as Metric })}
                  className="input w-full"
                >
                  <option value="sum">💰 Omsetning</option>
                  <option value="count">📦 Antall Ordrer</option>
                  <option value="quantity">🔢 Antall Varer</option>
                </select>
              </div>

              {/* Dimension Selection */}
              <div className="min-w-0">
                <label className="label break-words">Gruppér etter</label>
                <select
                  value={config.dimension}
                  onChange={(e) => setConfig({ ...config, dimension: e.target.value as Dimension })}
                  className="input w-full"
                >
                  <optgroup label="Tid">
                    <option value="day">Dag</option>
                    <option value="month">Måned</option>
                    <option value="year">År</option>
                  </optgroup>
                  <optgroup label="Kategori">
                    <option value="product">Produkt</option>
                    <option value="category">Varegruppe</option>
                  </optgroup>
                </select>
              </div>

              {/* Chart Type Selection */}
              <div className="min-w-0">
                <label className="label break-words">Graf type</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setConfig({ ...config, chartType: 'bar' })}
                    className={`p-2 rounded border text-xs sm:text-sm truncate ${config.chartType === 'bar' ? 'bg-primary-500/20 border-primary-500 text-primary-400' : 'border-dark-600 hover:bg-dark-700'}`}
                  >
                    <span className="block">📊</span>
                    <span className="hidden sm:inline">Bar</span>
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, chartType: 'line' })}
                    className={`p-2 rounded border text-xs sm:text-sm truncate ${config.chartType === 'line' ? 'bg-primary-500/20 border-primary-500 text-primary-400' : 'border-dark-600 hover:bg-dark-700'}`}
                  >
                    <span className="block">📈</span>
                    <span className="hidden sm:inline">Linje</span>
                  </button>
                  <button
                    onClick={() => setConfig({ ...config, chartType: 'pie' })}
                    className={`p-2 rounded border text-xs sm:text-sm truncate ${config.chartType === 'pie' ? 'bg-primary-500/20 border-primary-500 text-primary-400' : 'border-dark-600 hover:bg-dark-700'}`}
                  >
                    <span className="block">🥧</span>
                    <span className="hidden sm:inline">Kake</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-700 min-w-0">
                <label className="label break-words">Periode</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                    className="input w-full"
                    placeholder="Fra dato"
                  />
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                    className="input w-full"
                    placeholder="Til dato"
                  />
                </div>
              </div>

              {/* Customer / Reference Filter */}
              <div className="pt-4 border-t border-dark-700 min-w-0">
                <label className="label break-words text-sm">Søk kundenr / henvisning<br /><span className="text-dark-400">(Valgfritt)</span></label>
                <AutocompleteInput
                  value={config.search}
                  onChange={(val) => setConfig({ ...config, search: val })}
                  fetchSuggestions={async (q) => {
                    const response = await suggestionsApi.search(q);
                    return response.data;
                  }}
                  onSelect={(suggestion) => {
                    if ('value' in suggestion) {
                      setConfig({ ...config, search: String((suggestion as any).value) });
                    }
                  }}
                  placeholder="Kundenr, henvisning..."
                  minChars={1}
                />
              </div>

              {/* Export */}
              <div className="pt-4">
                <ExportButton targetRef={chartRef} filename={`analyse-${config.metric}-${config.dimension}`} />
              </div>
            </div>
          </div>

          <SavedViewsPanel
            title="Lagrede arbeidsflater"
            description="Lagre ditt favorittoppsett for analyser og åpne det igjen senere."
            views={views}
            isLoading={viewsLoading}
            onApply={(view) => setConfig(view.state)}
            onSave={(name, options) => saveView(name, options)}
            onDelete={(view) => deleteView(view)}
            onSetDefault={setDefaultView}
          />
        </div>

        {/* Visualization Area */}
        <div className="lg:col-span-3 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <ChartSkeleton height="h-96" />
              <div className="card">
                <TableSkeleton rows={6} columns={2} />
              </div>
            </div>
          ) : isError ? (
            <div className="card text-dark-300">
              Klarte ikke laste analysevisningen for valgt oppsett.
            </div>
          ) : (
            <div ref={chartRef} className="space-y-6">
              {/* Chart Card */}
              <div className="card min-h-[400px]">
                {config.chartType === 'bar' && (
                  <BarChart
                    data={data}
                    xKey="label"
                    yKey="value"
                    title={`${getMetricLabel(config.metric)} per ${getDimensionLabel(config.dimension)}`}
                    color="#3b82f6"
                    seriesName={getMetricLabel(config.metric).split(' (')[0]}
                    valueFormatter={valueFormatter}
                  />
                )}
                {config.chartType === 'line' && (
                  <LineChart
                    data={data}
                    xKey="label"
                    yKey="value"
                    title={`${getMetricLabel(config.metric)} per ${getDimensionLabel(config.dimension)}`}
                    color="#10b981"
                    seriesName={getMetricLabel(config.metric).split(' (')[0]}
                    valueFormatter={valueFormatter}
                  />
                )}
                {config.chartType === 'pie' && (
                  <PieChart
                    data={data}
                    nameKey="label"
                    valueKey="value"
                    title={`${getMetricLabel(config.metric)} per ${getDimensionLabel(config.dimension)}`}
                    seriesName={getMetricLabel(config.metric).split(' (')[0]}
                    valueFormatter={valueFormatter}
                  />
                )}
              </div>

              {/* Data Table */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">📋 Detaljer</h3>
                  {data.length > 0 && (
                    <span className="text-sm text-dark-400">
                      Viser {(detailsPage - 1) * DETAILS_PAGE_SIZE + 1}-
                      {Math.min(detailsPage * DETAILS_PAGE_SIZE, data.length)} av {data.length}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="p-3">{getDimensionLabel(config.dimension)}</th>
                        <th className="p-3 text-right">{getMetricLabel(config.metric)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data
                        .slice((detailsPage - 1) * DETAILS_PAGE_SIZE, detailsPage * DETAILS_PAGE_SIZE)
                        .map((item, i) => (
                          <tr key={item.label || i} className="border-b border-dark-800 hover:bg-dark-700/50">
                            <td className="p-3">{item.label}</td>
                            <td className="p-3 text-right font-mono">
                              {config.metric === 'sum'
                                ? new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(item.value)
                                : new Intl.NumberFormat('nb-NO').format(item.value)
                              }
                            </td>
                          </tr>
                        ))}
                      {data.length === 0 && (
                        <tr>
                          <td colSpan={2} className="p-8 text-center text-dark-400">
                            Ingen data funnet for valgt periode
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {data.length > DETAILS_PAGE_SIZE && (
                  <div className="mt-4">
                    <Pagination
                      pagination={{
                        page: detailsPage,
                        total: data.length,
                        limit: DETAILS_PAGE_SIZE,
                        totalPages: Math.ceil(data.length / DETAILS_PAGE_SIZE),
                      }}
                      onPageChange={setDetailsPage}
                      variant="simple"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
