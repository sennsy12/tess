import { Sparkles } from 'lucide-react';
import type { AnalyticsConfig, AnalyticsPreset } from './analyticsTypes';

interface AnalyticsPresetsProps {
  presets: AnalyticsPreset[];
  config: AnalyticsConfig;
  onApply: (config: AnalyticsConfig) => void;
}

function sameConfig(a: AnalyticsConfig, b: AnalyticsConfig): boolean {
  return (
    a.metric === b.metric &&
    a.dimension === b.dimension &&
    a.chartType === b.chartType &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.search === b.search
  );
}

/**
 * Horizontal chip row of recommended analyses. Replaces the tall preset
 * card in the sidebar so the chart starts higher on the page.
 */
export function AnalyticsPresetChips({ presets, config, onApply }: AnalyticsPresetsProps) {
  if (presets.length === 0) return null;

  return (
    <section aria-label="Anbefalte analyser">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary-400" aria-hidden />
        <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
          Anbefalte analyser
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const active = sameConfig(config, preset.config);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset.config)}
              title={preset.description}
              aria-pressed={active}
              className={`max-w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? 'border-primary-500 bg-primary-500/10 text-white'
                  : 'border-dark-700 bg-dark-900 text-dark-200 hover:border-dark-600 hover:bg-dark-800'
              }`}
            >
              <span className="font-medium">{preset.label}</span>
              {preset.bestFor && (
                <span className={`block text-xs mt-0.5 ${active ? 'text-primary-300' : 'text-dark-500'}`}>
                  {preset.bestFor}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
