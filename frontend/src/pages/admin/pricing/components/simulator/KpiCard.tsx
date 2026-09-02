import { diffColor } from './display';

interface KpiCardProps {
  label: string;
  value: string;
  /** Signed percentage shown below the value, coloured by sign. */
  subtext?: string;
  highlight?: 'positive' | 'negative' | 'neutral';
}

/** Big KPI card used in the simulation summary row. */
export function KpiCard({ label, value, subtext, highlight }: KpiCardProps) {
  const border =
    highlight === 'positive' ? 'border-green-600/40' :
    highlight === 'negative' ? 'border-red-600/40' :
    'border-dark-700';

  return (
    <div className={`bg-dark-800/50 rounded-xl border ${border} p-5`}>
      <p className="text-xs text-dark-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className={`text-sm mt-1 ${diffColor(parseFloat(subtext))}`}>{subtext}</p>}
    </div>
  );
}
