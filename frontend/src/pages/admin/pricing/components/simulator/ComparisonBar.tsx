import { formatMoneyNok } from '../../../../../lib/formatters';

interface ComparisonBarProps {
  label: string;
  current: number;
  simulated: number;
  /** When true a higher simulated value is worse (e.g. discount given). */
  inverse?: boolean;
}

/** Visual before / after bar comparison for one metric. */
export function ComparisonBar({ label, current, simulated, inverse = false }: ComparisonBarProps) {
  const max = Math.max(current, simulated, 1);
  const currentPct = (current / max) * 100;
  const simulatedPct = (simulated / max) * 100;

  const simColor = inverse
    ? simulated > current ? 'bg-red-500' : 'bg-green-500'
    : simulated >= current ? 'bg-green-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs text-dark-400 mb-1">
        <span>{label}</span>
        <span>
          {formatMoneyNok(current)} → {formatMoneyNok(simulated)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 w-14">Nå</span>
          <div className="flex-1 bg-dark-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${currentPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 w-14">Simulert</span>
          <div className="flex-1 bg-dark-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${simColor}`}
              style={{ width: `${simulatedPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
