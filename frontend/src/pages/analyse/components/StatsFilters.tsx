import { useState, useEffect } from 'react';
import { ExportButton } from '../../../components/ExportButton';
import { productsApi } from '../../../lib/api';
import { AutocompleteInput } from '../../../components/AutocompleteInput';

type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';

interface StatsFiltersProps {
  statType: StatType;
  setStatType: (type: StatType) => void;
  dateRange: { startDate: string; endDate: string };
  setDateRange: (range: { startDate: string; endDate: string }) => void;
  filters: { kundenr: string; varegruppe: string };
  setFilters: (filters: { kundenr: string; varegruppe: string }) => void;
  compareEnabled: boolean;
  setCompareEnabled: (enabled: boolean) => void;
  chartRef: React.RefObject<HTMLDivElement>;
}

export function StatsFilters({
  statType,
  setStatType,
  dateRange,
  setDateRange,
  filters,
  setFilters,
  compareEnabled,
  setCompareEnabled,
  chartRef,
}: StatsFiltersProps) {
  const [varegrupper, setVaregrupper] = useState<string[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [localVaregruppe, setLocalVaregruppe] = useState(filters.varegruppe);

  // Update local state when prop changes (e.g. on reset)
  useEffect(() => {
    setLocalVaregruppe(filters.varegruppe);
  }, [filters.varegruppe]);

  useEffect(() => {
    const loadGroups = async () => {
      setIsLoadingGroups(true);
      try {
        const response = await productsApi.getGroups();
        setVaregrupper(response.data);
      } catch (error) {
        console.error('Failed to load varegrupper:', error);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  const formatDate = (date: Date) => date.toISOString().slice(0, 10);

  const fetchVaregruppeSuggestions = async (query: string) => {
    if (!query.trim()) return [];
    const filtered = varegrupper.filter(g =>
      g.toLowerCase().includes(query.toLowerCase())
    );
    return filtered.map(g => ({ suggestion: g, type: 'varegruppe' }));
  };

  const handleVaregruppeSelect = (suggestion: any) => {
    setLocalVaregruppe(suggestion.suggestion);
    setFilters({ ...filters, varegruppe: suggestion.suggestion });
  };

  const handleVaregruppeChange = (val: string) => {
    setLocalVaregruppe(val);
  };

  const handleVaregruppeBlur = () => {
    if (localVaregruppe !== filters.varegruppe) {
      setFilters({ ...filters, varegruppe: localVaregruppe });
    }
  };

  const applyPreset = (daysBack?: number) => {
    const today = new Date();
    if (daysBack) {
      const start = new Date(today);
      start.setDate(start.getDate() - (daysBack - 1));
      setDateRange({ startDate: formatDate(start), endDate: formatDate(today) });
      return;
    }
    const yearStart = new Date(today.getFullYear(), 0, 1);
    setDateRange({ startDate: formatDate(yearStart), endDate: formatDate(today) });
  };

  const handleResetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setFilters({ kundenr: '', varegruppe: '' });
    setCompareEnabled(false);
    setLocalVaregruppe('');
  };

  return (
    <div className="card !overflow-visible relative z-30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">🔍 Filter</h3>
        <button onClick={handleResetFilters} className="btn-secondary text-xs">
          Nullstill filter
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">Statistikk type</label>
          <select
            value={statType}
            onChange={(e) => setStatType(e.target.value as StatType)}
            className="input w-full"
          >
            <option value="kunde">Per Kunde</option>
            <option value="varegruppe">Per Varegruppe</option>
            <option value="vare">Per Vare</option>
            <option value="lager">Per Lager</option>
            <option value="firma">Per Firma</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Fra dato</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Til dato</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyPreset(1)} className="btn-secondary text-xs">I dag</button>
          <button onClick={() => applyPreset(7)} className="btn-secondary text-xs">Siste 7 dager</button>
          <button onClick={() => applyPreset(30)} className="btn-secondary text-xs">Siste 30 dager</button>
          <button onClick={() => applyPreset()} className="btn-secondary text-xs">YTD</button>
          <button
            onClick={() => setDateRange({ startDate: '', endDate: '' })}
            className="btn-secondary text-xs"
          >
            Nullstill
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Kundenr (valgfritt)</label>
            <input
              type="text"
              value={filters.kundenr}
              onChange={(e) => setFilters({ ...filters, kundenr: e.target.value })}
              className="input w-full"
              placeholder="Kundenr"
            />
          </div>
          <div>
            <label className="label">Varegruppe (valgfritt)</label>
            <div className="flex gap-2">
              <div className="flex-1" onBlur={handleVaregruppeBlur}>
                <AutocompleteInput
                  value={localVaregruppe}
                  onChange={handleVaregruppeChange}
                  onSelect={handleVaregruppeSelect}
                  fetchSuggestions={fetchVaregruppeSuggestions}
                  placeholder="Søk varegruppe..."
                  minChars={0}
                  debounceMs={0}
                  className="w-full"
                />
              </div>
              {(localVaregruppe || filters.varegruppe) && (
                <button 
                  onClick={() => {
                    setLocalVaregruppe('');
                    setFilters({ ...filters, varegruppe: '' });
                  }}
                  className="btn-secondary px-3"
                  title="Nullstill varegruppe"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-dark-200">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => setCompareEnabled(e.target.checked)}
          />
          Sammenlign med forrige periode
        </label>
        <div className="pt-2">
          <ExportButton targetRef={chartRef} filename={`statistikk-${statType}`} />
        </div>
      </div>
    </div>
  );
}
