interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StatsTableProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
  pagination: Pagination;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  onRowClick?: (row: any) => void;
}

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

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      onPageChange(newPage);
    }
  };

  // Generer sidetall å vise (maks 5 synlige)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

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
                className={`hover:bg-dark-800/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(item)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1 || isLoading}
            className="px-3 py-1.5 text-sm rounded border border-dark-600 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Forrige
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, idx) =>
              pageNum === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-dark-400">...</span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum as number)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    page === pageNum
                      ? 'bg-primary-500 text-white'
                      : 'border border-dark-600 hover:bg-dark-700'
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages || isLoading}
            className="px-3 py-1.5 text-sm rounded border border-dark-600 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Neste →
          </button>
        </div>
      )}
    </div>
  );
}
