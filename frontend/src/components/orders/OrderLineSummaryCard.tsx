import { formatCurrencyNok, formatNumberNb } from '../../lib/formatters';

export interface OrderLineSummary {
  qty: number;
  netto: number;
  mva: number;
  brutto: number;
  weightedAvgPrice: number;
}

interface OrderLineSummaryCardProps {
  summary: OrderLineSummary;
}

export function OrderLineSummaryCard({ summary }: OrderLineSummaryCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dark-800">
      <div>
        <span className="text-sm text-dark-400">Antall linjer (stk)</span>
        <p className="text-lg font-semibold">{formatNumberNb(summary.qty)}</p>
      </div>
      <div>
        <span className="text-sm text-dark-400">Netto</span>
        <p className="text-lg font-semibold">{formatCurrencyNok(summary.netto)}</p>
      </div>
      <div>
        <span className="text-sm text-dark-400">MVA (25%)</span>
        <p className="text-lg font-semibold">{formatCurrencyNok(summary.mva)}</p>
      </div>
      <div>
        <span className="text-sm text-dark-400">Snittpris / stk</span>
        <p className="text-lg font-semibold">{formatCurrencyNok(summary.weightedAvgPrice)}</p>
      </div>
    </div>
  );
}
