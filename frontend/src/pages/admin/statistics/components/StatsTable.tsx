import { Pagination } from '../../../../components/admin';
import { StatsTableProps } from '../../../../types/statistics';

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
      <div className="overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-dark-900/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">{title.replace('Statistikk per ', '')}</th>
              <th className="table-header text-right">Antall Ordrer</th>
              <th className="table-header text-right">Total Sum</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={item[nameKey] || index}
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
            ))}
            {data.length === 0 && !isLoading && (
              <tr>
                <td colSpan={3} className="table-cell text-center text-dark-400 py-8">
                  Ingen data å vise
                </td>
              </tr>
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
