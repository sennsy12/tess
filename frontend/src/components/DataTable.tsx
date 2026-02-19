import { useState, useMemo, useEffect } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  rowKey?: (row: T) => string | number;
  className?: string; // Additional container classes
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'Ingen data funnet',
  pageSize = 50,
  rowKey,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  // Reset to page 1 when data changes
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Reset page when data changes significantly
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const getRowKey = (row: T, index: number) => {
    if (rowKey) return rowKey(row);
    if (row.id !== undefined && row.id !== null) return row.id;
    if (row.key !== undefined && row.key !== null) return row.key;
    const firstColumnKey = columns[0]?.key;
    if (firstColumnKey && row[firstColumnKey as keyof T] !== undefined) {
      return row[firstColumnKey as keyof T] as string | number;
    }
    return index;
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <span className="text-dark-600 opacity-20">↕</span>;
    if (sortDirection === 'asc') return <span className="text-primary-400">↑</span>;
    if (sortDirection === 'desc') return <span className="text-primary-400">↓</span>;
    return <span className="text-dark-600 opacity-20">↕</span>;
  };

  const getCellAlignment = (align?: 'left' | 'center' | 'right') => {
    switch(align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  if (data.length === 0) {
    return (
      <div className={`card flex flex-col items-center justify-center py-16 text-center ${className}`}>
        <div className="w-16 h-16 bg-dark-800 rounded-full flex items-center justify-center mb-4 text-3xl">∅</div>
        <p className="text-dark-300 font-medium text-lg">{emptyMessage}</p>
        <p className="text-dark-500 text-sm mt-2">Prøv å endre søkekriteriene dine</p>
      </div>
    );
  }

  return (
    <div className={`table-container flex flex-col ${className}`}>
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`table-header whitespace-nowrap group ${
                    column.sortable !== false ? 'cursor-pointer hover:bg-dark-700/60 transition-colors' : ''
                  } ${getCellAlignment(column.align)}`}
                  onClick={() => column.sortable !== false && handleSort(String(column.key))}
                >
                  <div className={`flex items-center gap-2 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <span className="group-hover:text-dark-200 transition-colors">{column.header}</span>
                    {column.sortable !== false && (
                      <span className="text-xs transition-all duration-200 transform scale-75 group-hover:scale-100">{getSortIcon(String(column.key))}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, index) => (
              <tr
                key={String(getRowKey(row, index))}
                className={`table-row group ${
                  onRowClick ? 'cursor-pointer hover:bg-primary-500/5 hover:border-primary-500/10' : ''
                }`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className={`table-cell whitespace-nowrap ${getCellAlignment(column.align)}`}>
                    {column.render
                      ? column.render(row[column.key as keyof T], row)
                      : row[column.key as keyof T] ?? <span className="text-dark-500">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-dark-800/20 border-t border-dark-700/50 mt-auto">
          <div className="text-sm text-dark-400 mb-4 sm:mb-0">
            Viser <span className="font-medium text-dark-200">{startIndex + 1}</span> - <span className="font-medium text-dark-200">{Math.min(endIndex, sortedData.length)}</span> av <span className="font-medium text-dark-200">{sortedData.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Første side"
            >
              <span className="sr-only">Første</span>
              ««
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Forrige side"
            >
              <span className="sr-only">Forrige</span>
              «
            </button>
            
            <div className="px-4 py-1.5 text-sm font-medium bg-dark-900 rounded-lg border border-dark-700 mx-1 min-w-[3rem] text-center">
              {currentPage} / {totalPages}
            </div>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Neste side"
            >
              <span className="sr-only">Neste</span>
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Siste side"
            >
              <span className="sr-only">Siste</span>
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
