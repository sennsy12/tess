import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Download, RotateCcw, X } from 'lucide-react';
import { ExportButton } from '../../../components/ExportButton';
import { AutocompleteInput } from '../../../components/AutocompleteInput';
import { toDateInputLocal } from '../../../lib/formatters';
import { downloadCsv } from '../../../lib/csv';
import { usePricingProductGroups } from '../../../hooks/pricing/usePricingQueries';
import {
  buildStatsExportRows,
  fetchAllStatRows,
} from '../statisticsUtils';
import { StatsFiltersProps, StatType } from '../../../types/statistics';

const STAT_TYPES: { value: StatType; label: string }[] = [
  { value: 'kunde', label: 'Kunde' },
  { value: 'varegruppe', label: 'Varegruppe' },
  { value: 'vare', label: 'Vare' },
  { value: 'lager', label: 'Lager' },
  { value: 'firma', label: 'Firma' },
];

/**
 * Compact control bar for the statistics page: grouping selector, period
 * quick picks, optional customer/product-group filters, period comparison
 * and export — all in one wrapping row.
 */
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
  exportFilenamePrefix = 'statistikk',
}: StatsFiltersProps) {
  const { data: varegrupper = [] } = usePricingProductGroups();
  const [localVaregruppe, setLocalVaregruppe] = useState(filters.varegruppe);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  useEffect(() => {
    setLocalVaregruppe(filters.varegruppe);
  }, [filters.varegruppe]);

  const fetchVaregruppeSuggestions = async (query: string) => {
    if (!query.trim()) return [];
    const filtered = varegrupper.filter((g) =>
      g.toLowerCase().includes(query.toLowerCase()),
    );
    return filtered.map((g) => ({ suggestion: g, type: 'varegruppe' }));
  };

  const handleVaregruppeSelect = (suggestion: { suggestion: string }) => {
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
      setDateRange({ startDate: toDateInputLocal(start), endDate: toDateInputLocal(today) });
      return;
    }
    const yearStart = new Date(today.getFullYear(), 0, 1);
    setDateRange({ startDate: toDateInputLocal(yearStart), endDate: toDateInputLocal(today) });
  };

  const isQuickPickActive = (daysBack?: number) => {
    const today = toDateInputLocal(new Date());
    if (dateRange.endDate !== today) return false;
    if (!daysBack) {
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      return dateRange.startDate === toDateInputLocal(yearStart);
    }
    const start = new Date();
    start.setDate(start.getDate() - (daysBack - 1));
    return dateRange.startDate === toDateInputLocal(start);
  };

  const handleResetFilters = () => {
    setDateRange({ startDate: '', endDate: '' });
    setFilters({ kundenr: '', varegruppe: '' });
    setCompareEnabled(false);
    setLocalVaregruppe('');
  };

  const handleCsvExport = async () => {
    setIsExportingCsv(true);
    try {
      const rows = await fetchAllStatRows(statType, {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
        kundenr: filters.kundenr || undefined,
        varegruppe: filters.varegruppe || undefined,
      });
      if (rows.length === 0) {
        toast.error('Ingen data å eksportere for valgt periode');
        return;
      }
      downloadCsv(`${exportFilenamePrefix}-${statType}-data`, buildStatsExportRows(rows, statType));
      toast.success(`${rows.length} rader eksportert til CSV`);
    } catch {
      toast.error('Kunne ikke eksportere statistikken');
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="card p-4 !overflow-visible relative z-30">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Statistikktype */}
        <div>
          <span className="label text-xs">Statistikk type</span>
          <div
            className="flex flex-wrap rounded-md border border-dark-700 overflow-hidden"
            role="group"
            aria-label="Statistikk type"
          >
            {STAT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={statType === type.value}
                onClick={() => setStatType(type.value)}
                className={`px-3 py-2 text-sm transition-colors ${
                  statType === type.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-900 text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Periode-hurtigvalg */}
        <div>
          <span className="label text-xs">Periode</span>
          <div
            className="flex rounded-md border border-dark-700 overflow-hidden"
            role="group"
            aria-label="Hurtigvalg periode"
          >
            {[
              { days: 1 as number | undefined, label: 'I dag' },
              { days: 7, label: '7 d' },
              { days: 30, label: '30 d' },
              { days: undefined, label: 'YTD' },
            ].map((pick) => (
              <button
                key={pick.label}
                type="button"
                aria-pressed={isQuickPickActive(pick.days)}
                onClick={() => applyPreset(pick.days)}
                className={`px-3 py-2 text-sm transition-colors ${
                  isQuickPickActive(pick.days)
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
          <label htmlFor="stats-start-date" className="label text-xs">
            Fra
          </label>
          <input
            id="stats-start-date"
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="input py-2"
          />
        </div>
        <div className="min-w-[8.5rem]">
          <label htmlFor="stats-end-date" className="label text-xs">
            Til
          </label>
          <input
            id="stats-end-date"
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="input py-2"
          />
        </div>

        {/* Kundenummer */}
        <div className="min-w-[8rem]">
          <label htmlFor="stats-kundenr" className="label text-xs">
            Kundenr <span className="text-dark-500">(valgfritt)</span>
          </label>
          <input
            id="stats-kundenr"
            type="text"
            value={filters.kundenr}
            onChange={(e) => setFilters({ ...filters, kundenr: e.target.value })}
            className="input py-2"
            placeholder="Kundenr"
          />
        </div>

        {/* Varegruppe */}
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="stats-varegruppe" className="label text-xs">
            Varegruppe <span className="text-dark-500">(valgfritt)</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1" onBlur={handleVaregruppeBlur}>
              <AutocompleteInput
                value={localVaregruppe}
                onChange={handleVaregruppeChange}
                onSelect={handleVaregruppeSelect}
                fetchSuggestions={fetchVaregruppeSuggestions}
                placeholder="Søk varegruppe..."
                minChars={2}
                debounceMs={200}
                className="w-full"
              />
            </div>
            {(localVaregruppe || filters.varegruppe) && (
              <button
                type="button"
                onClick={() => {
                  setLocalVaregruppe('');
                  setFilters({ ...filters, varegruppe: '' });
                }}
                className="btn-secondary px-3 py-2 text-sm"
                title="Nullstill varegruppe"
                aria-label="Nullstill varegruppe"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* Sammenligning */}
        <label className="flex items-center gap-2 text-sm text-dark-200 pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={compareEnabled}
            onChange={(e) => setCompareEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary-600"
          />
          Sammenlign med forrige periode
        </label>

        {/* Handlinger */}
        <div className="flex items-center gap-2 ml-auto pb-0.5">
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn-secondary py-2 text-sm flex items-center gap-1.5"
            title="Nullstill alle filtre"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Nullstill
          </button>
          <button
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={isExportingCsv}
            className="btn-secondary py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
            title="Eksporter hele datasettet (alle sider) som CSV"
          >
            <Download className="h-4 w-4" aria-hidden />
            {isExportingCsv ? 'Eksporterer…' : 'Eksporter CSV'}
          </button>
          <ExportButton targetRef={chartRef} filename={`${exportFilenamePrefix}-${statType}`} />
        </div>
      </div>
    </div>
  );
}
