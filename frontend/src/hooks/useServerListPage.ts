import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { DataTableState } from '../components/DataTable';
import type { SortDirection } from '../lib/queryKeys';

const isSameTableState = (a: DataTableState, b: DataTableState) =>
  a.sortKey === b.sortKey &&
  a.sortDirection === b.sortDirection &&
  a.currentPage === b.currentPage &&
  a.visibleColumnKeys.length === b.visibleColumnKeys.length &&
  a.visibleColumnKeys.every((key, index) => key === b.visibleColumnKeys[index]) &&
  Object.keys(a.columnLabels).length === Object.keys(b.columnLabels).length &&
  Object.entries(a.columnLabels).every(([key, value]) => b.columnLabels[key] === value);

export interface UrlSyncConfig<TFilters extends Record<string, string>> {
  read: (params: URLSearchParams) => Partial<{
    page: number;
    filters: TFilters;
    sortKey: string;
    sortDirection: SortDirection;
  }>;
  write: (
    page: number,
    filters: TFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => URLSearchParams;
}

export interface UseServerListPageOptions<TFilters extends Record<string, string>, TData> {
  queryKey: (
    page: number,
    filters: TFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => readonly unknown[];
  queryFn: (args: {
    page: number;
    filters: TFilters;
    sortKey: string | null;
    sortDirection: SortDirection;
  }) => Promise<TData>;
  defaultFilters: TFilters;
  defaultVisibleColumns: string[];
  pageSize: number;
  staleTime?: number;
  resetPageOnSort?: boolean;
  urlSync?: UrlSyncConfig<TFilters>;
  enabled?: boolean;
}

export function useServerListPage<TFilters extends Record<string, string>, TData>({
  queryKey,
  queryFn,
  defaultFilters,
  defaultVisibleColumns,
  pageSize,
  staleTime = 60_000,
  resetPageOnSort = true,
  urlSync,
  enabled = true,
}: UseServerListPageOptions<TFilters, TData>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasHydratedUrl = useRef(false);

  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState<TFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<TFilters>(defaultFilters);
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: null,
    sortDirection: null,
    currentPage: 1,
    visibleColumnKeys: defaultVisibleColumns,
    columnLabels: {},
  });

  useEffect(() => {
    if (!urlSync || hasHydratedUrl.current) return;
    hasHydratedUrl.current = true;
    const parsed = urlSync.read(searchParams);
    if (parsed.page) setPage(parsed.page);
    if (parsed.filters) {
      setDraftFilters(parsed.filters);
      setAppliedFilters(parsed.filters);
    }
    if (parsed.sortKey !== undefined && parsed.sortDirection !== undefined) {
      setTableState((prev) => ({
        ...prev,
        sortKey: parsed.sortKey ?? null,
        sortDirection: parsed.sortDirection ?? null,
      }));
    }
  }, [searchParams, urlSync]);

  const syncUrl = useCallback(
    (
      nextPage: number,
      nextFilters: TFilters,
      sortKey: string | null,
      sortDirection: SortDirection,
    ) => {
      if (!urlSync) return;
      const next = urlSync.write(nextPage, nextFilters, sortKey, sortDirection);
      setSearchParams(next, { replace: true });
    },
    [urlSync, setSearchParams],
  );

  const handleTableStateChange = useCallback(
    (nextState: DataTableState) => {
      setTableState((previousState) => {
        if (isSameTableState(previousState, nextState)) return previousState;
        const sortChanged =
          previousState.sortKey !== nextState.sortKey ||
          previousState.sortDirection !== nextState.sortDirection;
        if (sortChanged && resetPageOnSort) {
          setPage(1);
          syncUrl(1, appliedFilters, nextState.sortKey, nextState.sortDirection);
        }
        return nextState;
      });
    },
    [appliedFilters, resetPageOnSort, syncUrl],
  );

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    syncUrl(1, draftFilters, tableState.sortKey, tableState.sortDirection);
  }, [draftFilters, syncUrl, tableState.sortDirection, tableState.sortKey]);

  const handleReset = useCallback(() => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(1);
    syncUrl(1, defaultFilters, tableState.sortKey, tableState.sortDirection);
  }, [defaultFilters, syncUrl, tableState.sortDirection, tableState.sortKey]);

  const setPageAndSync = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      syncUrl(nextPage, appliedFilters, tableState.sortKey, tableState.sortDirection);
    },
    [appliedFilters, syncUrl, tableState.sortDirection, tableState.sortKey],
  );

  const applyFilters = useCallback(
    (filters: TFilters) => {
      setDraftFilters(filters);
      setAppliedFilters(filters);
      setPage(1);
      syncUrl(1, filters, tableState.sortKey, tableState.sortDirection);
    },
    [syncUrl, tableState.sortDirection, tableState.sortKey],
  );

  const query = useQuery({
    queryKey: queryKey(page, appliedFilters, tableState.sortKey, tableState.sortDirection),
    queryFn: () =>
      queryFn({
        page,
        filters: appliedFilters,
        sortKey: tableState.sortKey,
        sortDirection: tableState.sortDirection,
      }),
    staleTime,
    placeholderData: (prev) => prev,
    enabled,
  });

  return {
    page,
    setPage: setPageAndSync,
    pageSize,
    draftFilters,
    setDraftFilters,
    appliedFilters,
    tableState,
    setTableState,
    handleTableStateChange,
    handleApplyFilters,
    handleReset,
    applyFilters,
    ...query,
    showSkeleton: query.isLoading && !query.data,
    showRefetchBar: query.isFetching && !!query.data,
  };
}
