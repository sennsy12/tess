import { useMemo } from 'react';
import { StatCard } from '../StatCard';
import { formatCurrencyNok, formatDateNb, formatNumberNb } from '../../lib/formatters';

interface OrderLike {
  sum: number;
  dato: string;
}

interface OrderStatsStripProps {
  orders: OrderLike[];
  /** Total number of orders across all pages (server-side). */
  total: number;
  isLoading: boolean;
}

interface Stat {
  label: string;
  value: string;
  numericValue?: number;
  format?: (value: number) => string;
  accent?: 'indigo' | 'gold';
  title?: string;
}

/** Tooltip shared by page-scoped metrics (all except the global total). */
const PAGE_SCOPE_TITLE = 'Gjelder kun radene på denne siden';

/**
 * Summary metrics for the orders list. Page-scoped values are labelled
 * explicitly ("denne siden" / "på siden") so they are never mistaken for totals.
 */
export function OrderStatsStrip({ orders, total, isLoading }: OrderStatsStripProps) {
  const stats = useMemo<Stat[]>(() => {
    const pageSum = orders.reduce((acc, o) => acc + (o.sum ?? 0), 0);
    const latestDate = orders.reduce<string | null>((latest, o) => {
      return !latest || o.dato > latest ? o.dato : latest;
    }, null);
    return [
      {
        label: 'Ordrer totalt',
        value: formatNumberNb(total),
        numericValue: total,
        format: formatNumberNb,
        accent: 'gold',
      },
      { label: 'Sum denne siden', value: formatCurrencyNok(pageSum), title: `${formatCurrencyNok(pageSum)} · ${PAGE_SCOPE_TITLE}` },
      {
        label: 'Snitt ordreverdi',
        value: orders.length > 0 ? formatCurrencyNok(pageSum / orders.length) : '–',
        title: PAGE_SCOPE_TITLE,
      },
      {
        label: 'Siste på siden',
        value: latestDate ? formatDateNb(latestDate) : '–',
        title: PAGE_SCOPE_TITLE,
      },
    ];
  }, [orders, total]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-hidden>
        {stats.map((_, i) => (
          <div key={i} className="card min-h-[110px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          numericValue={stat.numericValue}
          format={stat.format}
          accent={stat.accent}
          title={stat.title}
        />
      ))}
    </div>
  );
}
