import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pagination } from '../../../../components/admin';
import { StatsTableProps } from '../../../../types/statistics';

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 48;

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
  const { page, limit, total, totalPages } = pagination;
  const startIndex = (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);
  const isRowClickable = Boolean(onRowClick);
  const useVirtual = data.length >= VIRTUALIZE_THRESHOLD;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
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

  const renderRow = (item: (typeof data)[number], index: number) => (
    <tr
      key={String(item[nameKey] ?? index)}
      className={`hover:bg-dark-800/30 transition-colors ${isRowClickable ? 'cursor-pointer' : ''}`}
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
      <td className="table-cell font-medium">{item[nameKey] || '-'}</td>
      <td className="table-cell text-right">{item.order_count || 0}</td>
      <td className="table-cell text-right font-semibold text-primary-400">
        {currencyFormatter(item.total_sum || 0)}
      </td>
    </tr>
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Detaljerte tall</h3>
        {total > 0 && (
          <span className="text-sm text-dark-400">
            Viser {startIndex}-{endIndex} av {total}
          </span>
        )}
      </div>
      <div
        ref={parentRef}
        className={`overflow-x-auto relative ${useVirtual ? 'max-h-[480px] overflow-y-auto' : ''}`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-dark-900/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
          </div>
        )}
        <table className="w-full">
          <thead className={useVirtual ? 'sticky top-0 z-[1] bg-dark-900' : undefined}>
            <tr>
              <th className="table-header">{title.replace('Statistikk per ', '')}</th>
              <th className="table-header text-right">Antall Ordrer</th>
              <th className="table-header text-right">Total Sum</th>
            </tr>
          </thead>
          <tbody>
            {useVirtual ? (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden>
                    <td colSpan={3} style={{ height: paddingTop, padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => renderRow(data[virtualRow.index], virtualRow.index))}
                {paddingBottom > 0 && (
                  <tr aria-hidden>
                    <td colSpan={3} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            ) : (
              <>
                {data.map((item, index) => renderRow(item, index))}
                {data.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={3} className="table-cell text-center text-dark-400 py-8">
                      Ingen data å vise
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
