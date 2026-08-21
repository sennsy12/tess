import { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PremiumStatCard } from '../../../components/PremiumStatCard';
import type { ComparisonData } from '../../../types/statistics';

interface StatsKpiStripProps {
  summary?: { totalOrders: number; totalRevenue: number };
  comparison?: ComparisonData | null;
  compareEnabled: boolean;
  isLoading: boolean;
}

const currency = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Period summary metrics for the statistics page, powered by the
 * /statistics/summary endpoint. When period comparison is enabled the
 * revenue KPI shows the delta versus the previous period.
 */
export function StatsKpiStrip({
  summary,
  comparison,
  compareEnabled,
  isLoading,
}: StatsKpiStripProps) {
  const avgOrderValue = useMemo(
    () =>
      summary && summary.totalOrders > 0 ? summary.totalRevenue / summary.totalOrders : null,
    [summary],
  );

  const delta = comparison?.deltaPercent;
  const DeltaIcon =
    delta !== null && delta !== undefined && delta < 0 ? TrendingDown : TrendingUp;

  const kpis = [
    {
      key: 'revenue',
      label: 'Total omsetning',
      value: summary ? currency(summary.totalRevenue) : '–',
      numericValue: summary?.totalRevenue,
      format: currency,
      accent: 'gold' as const,
      sub:
        compareEnabled && comparison ? (
          <span
            className={`inline-flex items-center gap-1 ${
              delta === null || delta === undefined
                ? 'text-dark-400'
                : delta >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
            }`}
          >
            {delta !== null && delta !== undefined && (
              <DeltaIcon className="h-3 w-3" aria-hidden />
            )}
            {delta === null || delta === undefined
              ? 'Ingen data for forrige periode'
              : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} % mot forrige periode`}
          </span>
        ) : undefined,
    },
    {
      key: 'orders',
      label: 'Antall ordrer',
      value: summary ? String(summary.totalOrders) : '–',
      numericValue: summary?.totalOrders,
      format: (n: number) => String(n),
    },
    {
      key: 'avg',
      label: 'Snitt ordreverdi',
      value: avgOrderValue !== null ? currency(avgOrderValue) : '–',
    },
    ...(compareEnabled
      ? [
          {
            key: 'prev',
            label: 'Forrige periode',
            value: comparison ? currency(comparison.previousTotal) : '–',
          },
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-hidden>
        {kpis.map((kpi) => (
          <div key={kpi.key} className="card min-h-[110px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger-1">
      {kpis.map((kpi) => (
        <PremiumStatCard
          key={kpi.key}
          label={kpi.label}
          value={kpi.value}
          numericValue={kpi.numericValue}
          format={kpi.format}
          accent={kpi.accent}
          sub={kpi.sub}
        />
      ))}
    </div>
  );
}
