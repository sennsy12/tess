import type { CustomerImpact, ProductImpact } from '../../../../../types/pricing';
import { formatMoneyNok } from '../../../../../lib/formatters';
import { diffColor, pct } from './display';

/** A single row in the impact table (customers or products). */
function ImpactRow({ name, current, simulated, difference, differencePct }: {
  name: string;
  current: number;
  simulated: number;
  difference: number;
  differencePct: number;
}) {
  return (
    <tr className="border-t border-dark-800 hover:bg-dark-800/30">
      <td className="py-2.5 px-3 text-sm font-medium text-dark-100">{name}</td>
      <td className="py-2.5 px-3 text-sm text-right font-mono">{formatMoneyNok(current)}</td>
      <td className="py-2.5 px-3 text-sm text-right font-mono">{formatMoneyNok(simulated)}</td>
      <td className={`py-2.5 px-3 text-sm text-right font-mono font-semibold ${diffColor(difference)}`}>
        {formatMoneyNok(difference)}
      </td>
      <td className={`py-2.5 px-3 text-sm text-right font-mono ${diffColor(differencePct)}`}>
        {pct(differencePct)}
      </td>
    </tr>
  );
}

interface ImpactTableProps<T> {
  title: string;
  data: T[];
  /** Derives the display name for a row. */
  nameKey: (row: T) => string;
}

/** Tabular breakdown of affected customers or products. Hidden when empty. */
export function ImpactTable<T extends CustomerImpact | ProductImpact>({
  title,
  data,
  nameKey,
}: ImpactTableProps<T>) {
  if (data.length === 0) return null;

  return (
    <div className="card">
      <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide mb-3">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-dark-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dark-800/50">
              <th className="text-left py-2 px-3 text-dark-400 font-medium">Navn</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">N&aring;v&aelig;rende</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">Simulert</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">Differanse</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <ImpactRow
                key={i}
                name={nameKey(row)}
                current={row.current_revenue}
                simulated={row.simulated_revenue}
                difference={row.difference}
                differencePct={row.difference_pct}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
