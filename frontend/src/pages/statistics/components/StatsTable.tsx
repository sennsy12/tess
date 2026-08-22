import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pagination } from '../../../components/admin';
import { StatsTableProps } from '../../../types/statistics';

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 41;

export function StatsTable({
  data,
  nameKey,
  title,
  currencyFormatter,
  pagination,
  onPageChange,
  isLoading,
  onRowClick,
}: StatsTableProps) {
  const [rowFilter, setRowFilter] = useState('');
  const filteredData = useMemo(() => {
    const query = rowFilter.trim().toLowerCase();
    if (!query) return data;
    return data.filter((item) => String(item[nameKey] ?? '').toLowerCase().includes(query));
  }, [data, nameKey, rowFilter]);

  const { page, limit, total, totalPages } = pagination;
  const startIndex = (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);
  const isRowClickable = Boolean(onRowClick);
  const useVirtual = filteredData.length >= VIRTUALIZE_THRESHOLD;
  const parentRef = useRef<HTMLDivElement>(null);

  // Share-of-total within the visible rows
  const totalValue = useMemo(() => {
    let sum = 0;
    for (const item of filteredData) {
      sum += Number(item.total_sum) || 0;
    }
    return sum;
  }, [filteredData]);

  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    enabled: useVirtual,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  const renderRow = (item: (typeof data)[number], index: number) => {
    const value = Number(item.total_sum) || 0;
    const share = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const name = String(item[nameKey] ?? '-');
    return (
      <tr
        key={String(item[nameKey] ?? index)}
        className={`table-row ${isRowClickable ? 'cursor-pointer' : ''}`}
        style={{ height: ROW_HEIGHT }}
        onClick={() => onRowClick?.(item)}
        role={isRowClickable ? 'button' : undefined}
        tabIndex={isRowClickable ? 0 : undefined}
        onKeyDown={(event) => {
          if (!onRowClick) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onRowClick(item);
          }
        }}
      >
        <td
          className="table-cell overflow-hidden text-ellipsis whitespace-nowrap font-medium text-dark-100"
          title={name}
        >
          {name}
        </td>
        <td className="table-cell whitespace-nowrap text-right tabular-nums">{item.order_count || 0}</td>
        <td className="table-cell whitespace-nowrap text-right font-semibold text-primary-400 tabular-nums">
          {currencyFormatter(value)}
        </td>
        <td className="table-cell whitespace-nowrap text-right text-dark-400 tabular-nums">
          {share.toFixed(1)} %
        </td>
      </tr>
    );
  };

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold">Detaljerte tall</h3>
        <div className="flex items-center gap-3">
          {data.length > 0 && (
            <input
              type="search"
              value={rowFilter}
              onChange={(e) => setRowFilter(e.target.value)}
              placeholder="Filtrer radene…"
              className="input py-1.5 text-sm w-44"
              aria-label="Filtrer tabellrader"
            />
          )}
          {total > 0 && (
            <span className="text-sm text-dark-400 tabular-nums whitespace-nowrap">
              Viser {startIndex}-{endIndex} av {total}
              {rowFilter.trim() ? ` · ${filteredData.length} treff` : ''}
            </span>
          )}
        </div>
      </div>
      <div
        ref={parentRef}
        className={`overflow-x-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent relative ${useVirtual ? 'max-h-[420px] overflow-y-auto' : ''}`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-dark-900/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
          </div>
        )}
        <table className="w-full table-fixed">
          <thead className={useVirtual ? 'sticky top-0 z-[1] bg-dark-900' : undefined}>
            <tr>
              <th className="table-header">{title.replace('Statistikk per ', '')}</th>
              <th className="table-header w-[10%] whitespace-nowrap text-right">Antall ordrer</th>
              <th className="table-header w-[15%] whitespace-nowrap text-right">Total sum</th>
              <th className="table-header w-[10%] whitespace-nowrap text-right">Andel</th>
            </tr>
          </thead>
          <tbody>
            {useVirtual ? (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden>
                    <td colSpan={4} style={{ height: paddingTop, padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => renderRow(filteredData[virtualRow.index], virtualRow.index))}
                {paddingBottom > 0 && (
                  <tr aria-hidden>
                    <td colSpan={4} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            ) : (
              <>
                {filteredData.map((item, index) => renderRow(item, index))}
                {filteredData.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={4} className="table-cell text-center text-dark-400 py-8">
                      {rowFilter.trim() ? 'Ingen rader matcher filteret' : 'Ingen data å vise'}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Pagination
          pagination={{ page, total, limit, totalPages }}
          onPageChange={onPageChange}
          variant="simple"
        />
      </div>
    </div>
  );
}
