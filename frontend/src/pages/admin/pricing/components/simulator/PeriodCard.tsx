import type { SimulatorForm } from '../../../../../types/pricing';
import { Spinner } from '../../../../../components/Spinner';

interface PeriodCardProps {
  form: SimulatorForm;
  update: <K extends keyof SimulatorForm>(key: K, value: SimulatorForm[K]) => void;
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  onReset: () => void;
  error: string | null;
}

/** Right config panel: date range, sample size and run/reset actions. */
export function PeriodCard({
  form,
  update,
  canRun,
  isRunning,
  onRun,
  onReset,
  error,
}: PeriodCardProps) {
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Tidsperiode</h3>

      <div>
        <label className="label">Fra dato</label>
        <input
          type="date"
          value={form.start_date}
          onChange={(e) => update('start_date', e.target.value)}
          className="input w-full"
        />
      </div>
      <div>
        <label className="label">Til dato</label>
        <input
          type="date"
          value={form.end_date}
          onChange={(e) => update('end_date', e.target.value)}
          className="input w-full"
        />
      </div>
      <div>
        <label className="label">Antall ordrelinjer (maks)</label>
        <select
          value={form.sample_size}
          onChange={(e) => update('sample_size', Number(e.target.value))}
          className="input w-full"
        >
          <option value={500}>500</option>
          <option value={1000}>1 000</option>
          <option value={2500}>2 500</option>
          <option value={5000}>5 000</option>
        </select>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onRun}
          disabled={!canRun || isRunning}
          className="btn-primary flex-1"
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="xs" />
              Simulerer...
            </span>
          ) : (
            'Simuler'
          )}
        </button>
        <button onClick={onReset} className="btn-secondary">
          Nullstill
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
