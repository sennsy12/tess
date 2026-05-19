import { ReactNode, useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../lib/csv';

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
  csvValue?: (value: any, row: T) => string | number;
  hideable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  pageSize?: number;
  rowKey?: (row: T) => string | number;
  className?: string; // Additional container classes
  paginate?: boolean;
  stickyFirstColumn?: boolean;
  enableColumnManagement?: boolean;
  enableCsvExport?: boolean;
  exportFilename?: string;
  title?: string;
  toolbarExtras?: ReactNode;
  storageKey?: string;
  state?: Partial<DataTableState>;
  onStateChange?: (state: DataTableState) => void;
}

type SortDirection = 'asc' | 'desc' | null;
export interface DataTableState {
  sortKey: string | null;
  sortDirection: SortDirection;
  currentPage: number;
  visibleColumnKeys: string[];
}

const getColumnKey = <T extends Record<string, any>>(column: Column<T>) => String(column.key);

const areStringArraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const areTableStatesEqual = (a: DataTableState, b: DataTableState) =>
  a.sortKey === b.sortKey &&
  a.sortDirection === b.sortDirection &&
  a.currentPage === b.currentPage &&
  areStringArraysEqual(a.visibleColumnKeys, b.visibleColumnKeys);

const sanitizeVisibleColumnKeys = (keys: string[], defaults: string[]) => {
  const filtered = keys.filter((key) => defaults.includes(key));
  return filtered.length > 0 ? filtered : defaults;
};

const normalizeState = (
  input: Partial<DataTableState> | undefined,
  defaults: DataTableState,
): DataTableState => {
  const nextSortKey = input?.sortKey ?? defaults.sortKey;
  const nextSortDirection = input?.sortDirection ?? defaults.sortDirection;
  const nextCurrentPage = input?.currentPage && input.currentPage > 0 ? input.currentPage : defaults.currentPage;
  const nextVisible = input?.visibleColumnKeys
    ? sanitizeVisibleColumnKeys(input.visibleColumnKeys, defaults.visibleColumnKeys)
    : defaults.visibleColumnKeys;

  return {
    sortKey: nextSortKey,
    sortDirection: nextSortKey ? nextSortDirection : null,
    currentPage: nextCurrentPage,
    visibleColumnKeys: nextVisible,
  };
};

const getComparableValue = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const timestamp = Date.parse(trimmed);
    const looksLikeDate = /[-/:T]/.test(trimmed);
    if (!Number.isNaN(timestamp) && looksLikeDate) return timestamp;
    return trimmed.toLowerCase();
  }
  return String(value).toLowerCase();
};

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'Ingen data funnet',
  pageSize = 50,
  rowKey,
  className = '',
  paginate = true,
  stickyFirstColumn = false,
  enableColumnManagement = false,
  enableCsvExport = false,
  exportFilename = 'table-export',
  title,
  toolbarExtras,
  storageKey,
  state,
  onStateChange,
}: DataTableProps<T>) {
  const defaultVisibleColumnKeys = useMemo(
    () => columns.map((column) => getColumnKey(column)),
    [columns],
  );

  const defaultState = useMemo<DataTableState>(
    () => ({
      sortKey: null,
      sortDirection: null,
      currentPage: 1,
      visibleColumnKeys: defaultVisibleColumnKeys,
    }),
    [defaultVisibleColumnKeys],
  );

  const storedState = useMemo<Partial<DataTableState> | undefined>(() => {
    if (!storageKey || typeof window === 'undefined') return undefined;
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Partial<DataTableState>) : undefined;
    } catch {
      return undefined;
    }
  }, [storageKey]);

  const isControlled = state !== undefined;
  const [internalState, setInternalState] = useState<DataTableState>(() =>
    normalizeState(storedState ?? state, defaultState),
  );
  const externalState = useMemo(() => normalizeState(state, defaultState), [state, defaultState]);
  const tableState = isControlled ? externalState : internalState;
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const densityKey = storageKey ? `${storageKey}:density` : null;
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (!densityKey || typeof window === 'undefined') return 'comfortable';
    return localStorage.getItem(densityKey) === 'compact' ? 'compact' : 'comfortable';
  });

  const setDensityAndPersist = (next: 'comfortable' | 'compact') => {
    setDensity(next);
    if (densityKey && typeof window !== 'undefined') {
      localStorage.setItem(densityKey, next);
    }
  };

  const cellClass = density === 'compact' ? 'table-cell !py-1.5 !px-2 text-xs' : 'table-cell';
  const headerClass = density === 'compact' ? 'table-header !py-2 !px-2 text-xs' : 'table-header';

  useEffect(() => {
    if (isControlled) return;
    setInternalState((current) => {
      const next = normalizeState(current, defaultState);
      return areTableStatesEqual(current, next) ? current : next;
    });
  }, [defaultState, isControlled]);

  const updateTableState = (updater: (previous: DataTableState) => DataTableState) => {
    const previous = tableState;
    const nextRaw = updater(previous);
    const next = normalizeState(nextRaw, defaultState);
    if (areTableStatesEqual(previous, next)) return;

    if (!isControlled) {
      setInternalState(next);
    }
    onStateChange?.(next);
  };

  const handleSort = (key: string) => {
    updateTableState((previous) => {
      if (previous.sortKey === key) {
        if (previous.sortDirection === 'asc') {
          return { ...previous, sortDirection: 'desc', currentPage: 1 };
        }
        if (previous.sortDirection === 'desc') {
          return { ...previous, sortKey: null, sortDirection: null, currentPage: 1 };
        }
        return { ...previous, sortDirection: 'asc', currentPage: 1 };
      }
      return {
        ...previous,
        sortKey: key,
        sortDirection: 'asc',
        currentPage: 1,
      };
    });
  };

  const visibleColumns = useMemo(
    () => columns.filter((column) => tableState.visibleColumnKeys.includes(getColumnKey(column))),
    [columns, tableState.visibleColumnKeys],
  );

  const sortedData = useMemo(() => {
    if (!tableState.sortKey || !tableState.sortDirection) return data;
    const sortKey = tableState.sortKey;

    return [...data].sort((a, b) => {
      const aValue = getComparableValue(a[sortKey]);
      const bValue = getComparableValue(b[sortKey]);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return tableState.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue);
      const bStr = String(bValue);
      return tableState.sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [data, tableState.sortDirection, tableState.sortKey]);

  const totalPages = paginate ? Math.ceil(sortedData.length / pageSize) : 1;
  const startIndex = paginate ? (tableState.currentPage - 1) * pageSize : 0;
  const endIndex = paginate ? startIndex + pageSize : sortedData.length;
  const paginatedData = paginate ? sortedData.slice(startIndex, endIndex) : sortedData;

  useEffect(() => {
    if (tableState.currentPage > totalPages && totalPages > 0) {
      updateTableState((previous) => ({ ...previous, currentPage: 1 }));
    }
  }, [tableState.currentPage, totalPages]);

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(tableState));
    }
  }, [storageKey, tableState]);

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
    if (tableState.sortKey !== key) return <span className="text-dark-600 opacity-20">↕</span>;
    if (tableState.sortDirection === 'asc') return <span className="text-primary-400">↑</span>;
    if (tableState.sortDirection === 'desc') return <span className="text-primary-400">↓</span>;
    return <span className="text-dark-600 opacity-20">↕</span>;
  };

  const getCellAlignment = (align?: 'left' | 'center' | 'right') => {
    switch(align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  const toggleColumn = (key: string) => {
    updateTableState((previous) => {
      const currentKeys = previous.visibleColumnKeys;
      if (currentKeys.includes(key)) {
        if (currentKeys.length === 1) return previous;
        return {
          ...previous,
          visibleColumnKeys: currentKeys.filter((columnKey) => columnKey !== key),
        };
      }
      return {
        ...previous,
        visibleColumnKeys: defaultVisibleColumnKeys.filter((columnKey) =>
          currentKeys.includes(columnKey) || columnKey === key,
        ),
      };
    });
  };

  const exportRows = () => {
    const exportableRows = sortedData.map((row) =>
      visibleColumns.reduce<Record<string, unknown>>((acc, column) => {
        const value = row[column.key as keyof T];
        acc[column.header] = column.csvValue ? column.csvValue(value, row) : value;
        return acc;
      }, {}),
    );
    downloadCsv(exportFilename, exportableRows);
  };

  const getStickyClasses = (columnIndex: number) => {
    if (!stickyFirstColumn || columnIndex !== 0) return '';
    return 'sticky left-0 z-10 bg-dark-900/95 shadow-[6px_0_10px_-8px_rgba(0,0,0,0.8)]';
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
      {(enableColumnManagement || enableCsvExport || toolbarExtras || title) && (
        <div className="flex flex-col gap-3 border-b border-dark-700/50 bg-dark-900/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-sm font-semibold text-dark-100">{title}</h3>}
            <p className="text-xs text-dark-500">
              {sortedData.length} rader · {visibleColumns.length} synlige kolonner
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbarExtras}
            {enableColumnManagement && (
              <div className="relative">
                <button
                  onClick={() => setIsColumnMenuOpen((open) => !open)}
                  className="btn-secondary text-sm"
                >
                  Kolonner
                </button>
                {isColumnMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-dark-700 bg-dark-900 p-3 shadow-2xl">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-500">
                      Synlige kolonner
                    </p>
                    {columns.length >= 8 && (
                      <input
                        type="search"
                        value={columnSearch}
                        onChange={(e) => setColumnSearch(e.target.value)}
                        placeholder="Søk kolonner…"
                        className="input w-full text-sm mb-2"
                      />
                    )}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {columns
                        .filter((column) => {
                          if (!columnSearch.trim()) return true;
                          const q = columnSearch.toLowerCase();
                          return column.header.toLowerCase().includes(q);
                        })
                        .map((column) => {
                        const columnKey = getColumnKey(column);
                        return (
                          <label key={columnKey} className="flex items-center gap-2 text-sm text-dark-200">
                            <input
                              type="checkbox"
                              checked={tableState.visibleColumnKeys.includes(columnKey)}
                              onChange={() => toggleColumn(columnKey)}
                              disabled={column.hideable === false}
                            />
                            <span>{column.header}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {enableColumnManagement && storageKey && (
              <div className="flex rounded-lg border border-dark-700 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setDensityAndPersist('comfortable')}
                  className={`px-2 py-1 ${density === 'comfortable' ? 'bg-primary-600/30 text-primary-300' : 'text-dark-400'}`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setDensityAndPersist('compact')}
                  className={`px-2 py-1 ${density === 'compact' ? 'bg-primary-600/30 text-primary-300' : 'text-dark-400'}`}
                >
                  Kompakt
                </button>
              </div>
            )}
            {enableCsvExport && (
              <button onClick={exportRows} className="btn-secondary text-sm">
                Eksporter CSV
              </button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">
        <table className="w-full border-collapse">
          {title && <caption className="sr-only">{title}</caption>}
          <thead>
            <tr>
              {visibleColumns.map((column, columnIndex) => (
                <th
                  key={getColumnKey(column)}
                  scope="col"
                  className={`${headerClass} whitespace-nowrap group ${
                    column.sortable !== false ? 'cursor-pointer hover:bg-dark-700/60 transition-colors' : ''
                  } ${getCellAlignment(column.align)} ${getStickyClasses(columnIndex)}`}
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
                onKeyDown={(event) => {
                  if (!onRowClick) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }}
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {visibleColumns.map((column, columnIndex) => (
                  <td
                    key={getColumnKey(column)}
                    className={`${cellClass} whitespace-nowrap ${getCellAlignment(column.align)} ${getStickyClasses(columnIndex)}`}
                  >
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
      {paginate && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-dark-800/20 border-t border-dark-700/50 mt-auto">
          <div className="text-sm text-dark-400 mb-4 sm:mb-0">
            Viser <span className="font-medium text-dark-200">{startIndex + 1}</span> - <span className="font-medium text-dark-200">{Math.min(endIndex, sortedData.length)}</span> av <span className="font-medium text-dark-200">{sortedData.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => updateTableState((previous) => ({ ...previous, currentPage: 1 }))}
              disabled={tableState.currentPage === 1}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Første side"
            >
              <span className="sr-only">Første</span>
              ««
            </button>
            <button
              onClick={() => updateTableState((previous) => ({ ...previous, currentPage: Math.max(1, previous.currentPage - 1) }))}
              disabled={tableState.currentPage === 1}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Forrige side"
            >
              <span className="sr-only">Forrige</span>
              «
            </button>
            
            <div className="px-4 py-1.5 text-sm font-medium bg-dark-900 rounded-lg border border-dark-700 mx-1 min-w-[3rem] text-center">
              {tableState.currentPage} / {totalPages}
            </div>
            
            <button
              onClick={() => updateTableState((previous) => ({ ...previous, currentPage: Math.min(totalPages, previous.currentPage + 1) }))}
              disabled={tableState.currentPage === totalPages}
              className="p-2 rounded-lg bg-dark-800/50 text-dark-300 hover:bg-dark-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Neste side"
            >
              <span className="sr-only">Neste</span>
              »
            </button>
            <button
              onClick={() => updateTableState((previous) => ({ ...previous, currentPage: totalPages }))}
              disabled={tableState.currentPage === totalPages}
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
