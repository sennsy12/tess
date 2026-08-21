import { ChevronRight, Calendar, Building2, Hash } from 'lucide-react';
import { OrderWorkflowBadge } from './OrderWorkflowBadge';

export interface OrderMobileCardData {
  ordrenr: number;
  dato: string;
  sum: number;
  firmanavn?: string | null;
  kunderef?: string | null;
  kundeordreref?: string | null;
  workflow_status?: string;
}

interface OrderMobileCardProps {
  order: OrderMobileCardData;
  onClick: () => void;
}

const currency = (value: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(value);

export function OrderMobileCard({ order, onClick }: OrderMobileCardProps) {
  const ref = order.kunderef || order.kundeordreref;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full text-left rounded-lg border border-dark-800 bg-dark-900 p-4 transition-colors duration-150 hover:border-primary-500/50 hover:bg-dark-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-primary-400">#{order.ordrenr}</span>
            <OrderWorkflowBadge status={order.workflow_status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-400">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {new Date(order.dato).toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            {order.firmanavn && (
              <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {order.firmanavn}
              </span>
            )}
            {ref && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {ref}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-bold text-white tabular-nums">{currency(order.sum)}</span>
          <ChevronRight
            className="h-4 w-4 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all"
            aria-hidden
          />
        </div>
      </div>
    </button>
  );
}
