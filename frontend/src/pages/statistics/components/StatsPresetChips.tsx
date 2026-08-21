import { Sparkles } from 'lucide-react';
import { STATISTICS_PRESETS } from '../statisticsPresets';
import type { StatType } from '../../../types/statistics';

interface StatsPresetChipsProps {
  statType: StatType;
  dateRange: { startDate: string; endDate: string };
  filters: { kundenr: string; varegruppe: string };
  compareEnabled: boolean;
  onApply: (presetId: string) => void;
}

/**
 * Horizontal chip row of recommended statistics setups. Active state is
 * derived by comparing the preset's applied result with the current state.
 */
export function StatsPresetChips({
  statType,
  dateRange,
  filters,
  compareEnabled,
  onApply,
}: StatsPresetChipsProps) {
  return (
    <section aria-label="Anbefalte analyser">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary-400" aria-hidden />
        <h3 className="text-sm font-semibold text-dark-300 uppercase tracking-wider">
          Anbefalte analyser
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {STATISTICS_PRESETS.map((preset) => {
          const applied = preset.apply();
          const active =
            applied.statType === statType &&
            applied.compareEnabled === compareEnabled &&
            applied.dateRange.startDate === dateRange.startDate &&
            applied.dateRange.endDate === dateRange.endDate &&
            applied.filters.kundenr === filters.kundenr &&
            applied.filters.varegruppe === filters.varegruppe;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset.id)}
              title={preset.description}
              aria-pressed={active}
              className={`max-w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                active
                  ? 'border-primary-500 bg-primary-500/10 text-white'
                  : 'border-dark-700 bg-dark-900 text-dark-200 hover:border-dark-600 hover:bg-dark-800'
              }`}
            >
              <span className="font-medium">{preset.label}</span>
              <span className={`block text-xs mt-0.5 ${active ? 'text-primary-300' : 'text-dark-500'}`}>
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
