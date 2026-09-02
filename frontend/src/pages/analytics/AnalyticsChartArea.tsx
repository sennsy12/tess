import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, AlertCircle, Inbox, RotateCcw } from 'lucide-react';
import { BarChart, LineChart, PieChart } from '../../components/Charts';
import { ChartSkeleton, TableSkeleton } from '../../components/Skeleton';
import { Pagination } from '../../components/admin';
import { getDimensionLabel, getMetricLabel } from './analyticsLabels';
import type { AnalyticsConfig, AnalyticsDataPoint } from './analyticsTypes';

const DETAILS_PAGE_SIZE = 25;

type SortKey = 'label' | 'value';
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface AnalyticsChartAreaProps {
  config: AnalyticsConfig;
  data: AnalyticsDataPoint[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  valueFormatter: (value: number) => string;
  chartRef: React.RefObject<HTMLDivElement>;
  detailsPage: number;
  onDetailsPageChange: (page: number) => void;
}

export function AnalyticsChartArea({
  config,
  data,
  isLoading,
  isError,
  onRetry,
  valueFormatter,
  chartRef,
  detailsPage,
  onDetailsPageChange,
}: AnalyticsChartAreaProps) {
  const [sort, setSort] = useState<SortState>({ key: 'value', dir: 'desc' });

  const sortedData = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const result =
        sort.key === 'label'
          ? a.label.localeCompare(b.label, 'nb-NO')
          : a.value - b.value;
      return sort.dir === 'asc' ? result : -result;
    });
    return copy;
  }, [data, sort]);

  const maxValue = useMemo(
    () => data.reduce((max, d) => Math.max(max, d.value), 0),
    [data],
  );

  const totalValue = useMemo(
    () => data.reduce((acc, d) => acc + d.value, 0),
    [data],
  );

  if (isLoading) {
    return (
      <div className="lg:col-span-3 space-y-6 min-w-0">
        <ChartSkeleton height="h-96" />
        <div className="card">
          <TableSkeleton rows={6} columns={2} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="lg:col-span-3 min-w-0">
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" aria-hidden />
          <p className="text-dark-300 max-w-sm">
            Klarte ikke laste analysevisningen for valgt oppsett.
          </p>
          <button type="button" onClick={onRetry} className="btn-secondary text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden />
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  const chartTitle = `${getMetricLabel(config.metric)} per ${getDimensionLabel(config.dimension)}`;
  const seriesName = getMetricLabel(config.metric).split(' (')[0];

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? 'asc' : 'desc' },
    );
    onDetailsPageChange(1);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sort.key !== key) return null;
    return sort.dir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
    );
  };

  return (
    <div className="lg:col-span-3 space-y-6 min-w-0">
      <div ref={chartRef} className="space-y-6">
        <div className="card relative min-h-[400px]">
          {config.chartType === 'bar' && (
            <BarChart
              data={data}
              xKey="label"
              yKey="value"
              title={chartTitle}
              color="#6366f1"
              seriesName={seriesName}
              valueFormatter={valueFormatter}
            />
          )}
          {config.chartType === 'line' && (
            <LineChart
              data={data}
              xKey="label"
              yKey="value"
              title={chartTitle}
              color="#6366f1"
              seriesName={seriesName}
              valueFormatter={valueFormatter}
            />
          )}
          {config.chartType === 'pie' && (
            <PieChart
              data={data}
              nameKey="label"
              valueKey="value"
              title={chartTitle}
              seriesName={seriesName}
              valueFormatter={valueFormatter}
            />
          )}
          {data.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-dark-900/80 rounded-lg">
              <Inbox className="h-8 w-8 text-dark-500" aria-hidden />
              <p className="text-dark-400 text-sm">Ingen data for valgt periode og filtre</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Detaljer</h3>
            {data.length > 0 && (
              <span className="text-sm text-dark-400 tabular-nums">
                Viser {(detailsPage - 1) * DETAILS_PAGE_SIZE + 1}-
                {Math.min(detailsPage * DETAILS_PAGE_SIZE, data.length)} av {data.length}
              </span>
            )}
          </div>

          <div className="table-container overflow-hidden">
            <table className="w-full table-fixed text-left min-w-0">
              <thead>
                <tr>
                  <th className="table-header w-[110px] overflow-hidden whitespace-nowrap" aria-sort={sort.key === 'label' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      onClick={() => toggleSort('label')}
                      className="inline-flex max-w-full items-center gap-1 uppercase tracking-wider hover:text-dark-200"
                    >
                      <span className="truncate">{getDimensionLabel(config.dimension)}</span>
                      {renderSortIcon('label')}
                    </button>
                  </th>
                  <th className="table-header w-[176px] overflow-hidden whitespace-nowrap text-right" aria-sort={sort.key === 'value' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button
                      type="button"
                      onClick={() => toggleSort('value')}
                      className="inline-flex max-w-full items-center justify-end gap-1 uppercase tracking-wider hover:text-dark-200 ml-auto"
                    >
                      <span className="truncate">{getMetricLabel(config.metric)}</span>
                      {renderSortIcon('value')}
                    </button>
                  </th>
                  <th className="table-header overflow-hidden whitespace-nowrap">Andel av totalt</th>
                </tr>
              </thead>
              <tbody>
                {sortedData
                  .slice(
                    (detailsPage - 1) * DETAILS_PAGE_SIZE,
                    detailsPage * DETAILS_PAGE_SIZE,
                  )
                  .map((item) => {
                    const share = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                    return (
                      <tr key={item.label} className="table-row">
                        <td
                          className="table-cell overflow-hidden text-ellipsis whitespace-nowrap font-medium text-dark-100"
                          title={item.label}
                        >
                          {item.label}
                        </td>
                        <td className="table-cell whitespace-nowrap text-right tabular-nums">{valueFormatter(item.value)}</td>
                        <td className="table-cell min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-dark-700/60">
                              <div
                                className="h-full rounded-full bg-primary-500/80"
                                style={{ width: `${maxValue > 0 ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 1 : 0) : 0}%` }}
                                role="presentation"
                              />
                            </div>
                            <span className="w-[52px] shrink-0 text-right text-xs text-dark-400 tabular-nums whitespace-nowrap">
                              {share.toFixed(1)} %
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-dark-400">
                      Ingen data funnet for valgt periode
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.length > DETAILS_PAGE_SIZE && (
            <div className="mt-4">
              <Pagination
                pagination={{
                  page: detailsPage,
                  total: data.length,
                  limit: DETAILS_PAGE_SIZE,
                  totalPages: Math.ceil(data.length / DETAILS_PAGE_SIZE),
                }}
                onPageChange={onDetailsPageChange}
                variant="simple"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
