import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi, productsApi } from '../lib/api';
import { catalogKeys, kundeKeys } from '../lib/queryKeys';
import { useDebouncedValue } from './useDebouncedValue';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const GROUPS_STALE_TIME_MS = 10 * 60 * 1000;

/**
 * Catalog browsing state for the order placement flow.
 *
 * Owns the debounced search input, the varegruppe filter, pagination state
 * and the two backing queries (catalog page + product groups). Filter
 * changes automatically reset to the first page.
 */
export function useCatalogBrowse() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [varegruppe, setVaregruppe] = useState('');
  const [page, setPage] = useState(1);

  const filtersKey = useMemo(
    () => ({ search: search.trim(), varegruppe }),
    [search, varegruppe],
  );

  const catalogQuery = useQuery({
    queryKey: catalogKeys.list(page, filtersKey, null, null),
    queryFn: async () => {
      const res = await catalogApi.getAll({
        page,
        limit: PAGE_SIZE,
        ...filtersKey,
      });
      return res.data;
    },
    placeholderData: (prev) => prev,
  });

  const productGroupsQuery = useQuery({
    queryKey: kundeKeys.productGroups(),
    queryFn: async () => {
      const res = await productsApi.getGroups();
      return (res.data ?? []) as string[];
    },
    staleTime: GROUPS_STALE_TIME_MS,
  });

  const products = catalogQuery.data?.data ?? [];
  const pagination = catalogQuery.data?.pagination;
  const totalPages = Math.max(1, Math.ceil((pagination?.total ?? 0) / PAGE_SIZE));

  /** Applies a new search term and resets to the first page. */
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  /** Applies a new varegruppe filter and resets to the first page. */
  const handleVaregruppeChange = (value: string) => {
    setVaregruppe(value);
    setPage(1);
  };

  return {
    searchInput,
    onSearchChange: handleSearchChange,
    varegruppe,
    onVaregruppeChange: handleVaregruppeChange,
    page,
    setPage,
    products,
    totalPages,
    totalCount: pagination?.total ?? 0,
    catalogQuery,
    groups: productGroupsQuery.data ?? [],
  };
}
