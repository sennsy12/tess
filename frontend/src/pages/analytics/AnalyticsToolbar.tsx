import { RotateCcw } from 'lucide-react';
import { ExportButton } from '../../components/ExportButton';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { shiftDaysLocal, toDateInputLocal } from '../../lib/formatters';
import { suggestionsApi } from '../../lib/api';
import { createDefaultAnalyticsConfig } from './analyticsDefaults';
import type { AnalyticsConfig, ChartType, Dimension, Metric } from './analyticsTypes';

interface AnalyticsToolbarProps {
  config: AnalyticsConfig;
  onConfigChange: (config: AnalyticsConfig) => void;
  chartRef: React.RefObject<HTMLDivElement>;
  exportFilenamePrefix: string;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'line', label: 'Linje' },
  { value: 'pie', label: 'Kake' },
];

const PERIOD_QUICK_PICKS = [
  { days: 30, label: '30 d' },
  { days: 90, label: '90 d' },
  { days: 365, label: '1 år' },
];

function isPeriodActive(config: AnalyticsConfig, days: number): boolean {
  return (
    config.startDate === shiftDaysLocal(days - 1) &&
    config.endDate === toDateInputLocal(new Date())
  );
}

/**
 * Compact control bar above the chart. Keeps the primary analysis controls
 * (metric, grouping, chart type, period, search, export) in one place so
 * the sidebar can stay slim.
 */
export function AnalyticsToolbar({
  config,
  onConfigChange,
  chartRef,
  exportFilenamePrefix,
}: AnalyticsToolbarProps) {
  const set = (patch: Partial<AnalyticsConfig>) => onConfigChange({ ...config, ...patch });

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Måltall */}
        <div className="min-w-[10rem]">
          <label htmlFor="analytics-metric" className="label text-xs">
            Måltall
          </label>
          <select
            id="analytics-metric"
            value={config.metric}
            onChange={(e) => set({ metric: e.target.value as Metric })}
            className="input py-2"
          >
            <option value="sum">Omsetning</option>
            <option value="count">Antall ordrer</option>
            <option value="quantity">Antall varer</option>
          </select>
        </div>

        {/* Dimensjon */}
        <div className="min-w-[9rem]">
          <label htmlFor="analytics-dimension" className="label text-xs">
            Gruppér etter
          </label>
          <select
            id="analytics-dimension"
            value={config.dimension}
            onChange={(e) => set({ dimension: e.target.value as Dimension })}
            className="input py-2"
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

        {/* Graftype */}
        <div>
          <span className="label text-xs">Graf</span>
          <div className="flex rounded-md border border-dark-700 overflow-hidden" role="group" aria-label="Graf type">
            {CHART_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={config.chartType === type.value}
                onClick={() => set({ chartType: type.value })}
                className={`px-3 py-2 text-sm transition-colors ${
                  config.chartType === type.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-900 text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Periode */}
        <div>
          <span className="label text-xs">Periode</span>
          <div className="flex rounded-md border border-dark-700 overflow-hidden" role="group" aria-label="Hurtigvalg periode">
            {PERIOD_QUICK_PICKS.map((pick) => (
              <button
                key={pick.days}
                type="button"
                aria-pressed={isPeriodActive(config, pick.days)}
                onClick={() =>
                  set({
                    startDate: shiftDaysLocal(pick.days - 1),
                    endDate: toDateInputLocal(new Date()),
                  })
                }
                className={`px-3 py-2 text-sm transition-colors ${
                  isPeriodActive(config, pick.days)
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-900 text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                }`}
              >
                {pick.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fra / til */}
        <div className="min-w-[8.5rem]">
          <label htmlFor="analytics-start-date" className="label text-xs">
            Fra
          </label>
          <input
            id="analytics-start-date"
            type="date"
            value={config.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
            className="input py-2"
          />
        </div>
        <div className="min-w-[8.5rem]">
          <label htmlFor="analytics-end-date" className="label text-xs">
            Til
          </label>
          <input
            id="analytics-end-date"
            type="date"
            value={config.endDate}
            onChange={(e) => set({ endDate: e.target.value })}
            className="input py-2"
          />
        </div>

        {/* Søk */}
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="analytics-search" className="label text-xs">
            Søk <span className="text-dark-500">(valgfritt)</span>
          </label>
          <AutocompleteInput
            id="analytics-search"
            value={config.search}
            onChange={(val) => set({ search: val })}
            fetchSuggestions={async (q) => {
              const response = await suggestionsApi.search(q);
              return response.data;
            }}
            onSelect={(suggestion) => {
              if ('value' in suggestion) {
                set({ search: String((suggestion as { value: unknown }).value) });
              }
            }}
            placeholder="Kundenr, henvisning..."
            minChars={1}
          />
        </div>

        {/* Handlinger */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => onConfigChange(createDefaultAnalyticsConfig())}
            className="btn-secondary py-2 text-sm flex items-center gap-1.5"
            title="Nullstill til standardvisning"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Nullstill
          </button>
          <ExportButton
            targetRef={chartRef}
            filename={`${exportFilenamePrefix}-${config.metric}-${config.dimension}`}
          />
        </div>
      </div>
    </div>
  );
}
