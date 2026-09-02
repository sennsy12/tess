import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { StatCard } from '../../components/StatCard';
import type { AnalyticsDataPoint } from './analyticsTypes';

interface AnalyticsKpiStripProps {
  data: AnalyticsDataPoint[];
  isLoading: boolean;
  valueFormatter: (value: number) => string;
}

interface Kpi {
  key: string;
  label: string;
  value: string;
  numericValue?: number;
  format?: (value: number) => string;
  accent?: 'indigo' | 'gold';
  sub?: React.ReactNode;
  spark?: { label: string; value: number }[];
}

/**
 * Summary metrics computed from the already-fetched result set — no
 * additional API call. Gives the page an at-a-glance answer before the
 * user reads the chart.
 */
export function AnalyticsKpiStrip({ data, isLoading, valueFormatter }: AnalyticsKpiStripProps) {
  const kpis = useMemo<Kpi[]>(() => {
    const total = data.reduce((acc, d) => acc + d.value, 0);
    const top = data.reduce<AnalyticsDataPoint | null>(
      (best, d) => (!best || d.value > best.value ? d : best),
      null,
    );
    const spark = [...data]
      .sort((a, b) => a.label.localeCompare(b.label, 'nb-NO'))
      .map((d) => ({ label: d.label, value: d.value }));

    return [
      {
        key: 'total',
        label: 'Totalt',
        value: valueFormatter(total),
        numericValue: total,
        format: valueFormatter,
        accent: 'gold' as const,
        spark,
      },
      {
        key: 'avg',
        label: 'Snitt per gruppe',
        value: data.length > 0 ? valueFormatter(total / data.length) : '–',
      },
      {
        key: 'top',
        label: 'Topp-gruppe',
        value: top ? top.label : '–',
        sub: top ? (
          <span className="text-dark-400 inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-gold-400" aria-hidden />
            {valueFormatter(top.value)}
          </span>
        ) : undefined,
      },
      {
        key: 'count',
        label: 'Antall grupper',
        value: String(data.length),
      },
    ];
  }, [data, valueFormatter]);

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
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 animate-fade-in">
      {kpis.map((kpi) => (
        <StatCard
          key={kpi.key}
          label={kpi.label}
          value={kpi.value}
          numericValue={kpi.numericValue}
          format={kpi.format}
          accent={kpi.accent}
          sub={kpi.sub}
          sparkData={kpi.spark}
        />
      ))}
    </div>
  );
}
