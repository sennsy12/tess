import { ExportButton } from '../../../components/ExportButton';

type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';

interface StatsFiltersProps {
  statType: StatType;
  setStatType: (type: StatType) => void;
  dateRange: { startDate: string; endDate: string };
  setDateRange: (range: { startDate: string; endDate: string }) => void;
  chartRef: React.RefObject<HTMLDivElement>;
}

export function StatsFilters({
  statType,
  setStatType,
  dateRange,
  setDateRange,
  chartRef,
}: StatsFiltersProps) {
  return (
    <div className="card">
      <h3 className="font-semibold text-lg mb-4">🔍 Filter</h3>
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
        <div className="pt-2">
          <ExportButton targetRef={chartRef} filename={`statistikk-${statType}`} />
        </div>
      </div>
    </div>
  );
}
