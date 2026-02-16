import { useState, useEffect, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { statisticsApi, suggestionsApi } from '../../lib/api';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ExportButton } from '../../components/ExportButton';
import { AutocompleteInput } from '../../components/AutocompleteInput';

type Metric = 'sum' | 'count' | 'quantity';
type Dimension = 'day' | 'month' | 'year' | 'product' | 'category';
type ChartType = 'bar' | 'line' | 'pie';

export function AdvancedAnalytics() {
  const [config, setConfig] = useState({
    metric: 'sum' as Metric,
    dimension: 'month' as Dimension,
    chartType: 'bar' as ChartType,
    startDate: '',
    endDate: '',
    search: '',
  });

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [config.metric, config.dimension, config.startDate, config.endDate, config.search]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const response = await statisticsApi.getCustom({
        metric: config.metric,
        dimension: config.dimension,
        startDate: config.startDate || undefined,
        endDate: config.endDate || undefined,
        search: config.search || undefined,
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
        </div>

        {/* Visualization Area */}
        <div className="lg:col-span-3 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-96 card">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
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
                <h3 className="font-semibold text-lg mb-4">📋 Detaljer</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-dark-700">
                        <th className="p-3">{getDimensionLabel(config.dimension)}</th>
                        <th className="p-3 text-right">{getMetricLabel(config.metric)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, i) => (
                        <tr key={i} className="border-b border-dark-800 hover:bg-dark-700/50">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
