import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { QueryRefetchBar } from '../../components/QueryRefetchBar';
import { productKeys, kundeKeys, type ProductFilters } from '../../lib/queryKeys';
import {
  productFiltersFromSearchParams,
  productFiltersToSearchParams,
} from '../../lib/listPageUrl';
import { EmptyState } from '../../components/EmptyState';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { PageHeader, FilterBar, TableSkeleton, Pagination } from '../../components/admin';
import { productsApi } from '../../lib/api';
import { getApiError } from '../../lib/apiErrors';
import { formatMoneyNok } from '../../lib/formatters';

interface Product {
  varekode: string;
  varenavn: string;
  varegruppe: string | null;
  base_price: number;
}

const PAGE_SIZE = 25;

const BADGE_COLORS = [
  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  'bg-green-500/10 text-green-400 border-green-500/30',
  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'bg-pink-500/10 text-pink-400 border-pink-500/30',
  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  'bg-red-500/10 text-red-400 border-red-500/30',
  'bg-teal-500/10 text-teal-400 border-teal-500/30',
];

const EMPTY_FILTERS: ProductFilters = { search: '', groupFilter: '' };

export function AdminProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hasHydratedUrl = useRef(false);
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [editingPrice, setEditingPrice] = useState<{ product: Product; value: string } | null>(null);
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: 'varenavn',
    sortDirection: 'asc',
    currentPage: 1,
    visibleColumnKeys: ['varekode', 'varenavn', 'varegruppe', 'base_price'],
  });

  useEffect(() => {
    if (hasHydratedUrl.current) return;
    hasHydratedUrl.current = true;
    const parsed = productFiltersFromSearchParams(searchParams);
    if (parsed.page) setPage(parsed.page);
    if (parsed.filters) {
      setDraftFilters(parsed.filters);
      setAppliedFilters(parsed.filters);
    }
    if (parsed.sortKey && parsed.sortDirection) {
      setTableState((prev) => ({
        ...prev,
        sortKey: parsed.sortKey ?? null,
        sortDirection: parsed.sortDirection ?? null,
      }));
    }
  }, [searchParams]);

  const syncUrl = useCallback(
    (
      nextPage: number,
      filters: ProductFilters,
      sortKey: string | null,
      sortDirection: DataTableState['sortDirection'],
    ) => {
      setSearchParams(productFiltersToSearchParams(nextPage, filters, sortKey, sortDirection), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const { data: groups } = useQuery({
    queryKey: productKeys.groups(),
    queryFn: () => productsApi.getGroups().then((r) => r.data as string[]),
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: productsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: productKeys.list(
      page,
      appliedFilters,
      tableState.sortKey,
      tableState.sortDirection,
    ),
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (appliedFilters.search.trim()) params.search = appliedFilters.search.trim();
      if (appliedFilters.groupFilter) params.varegruppe = appliedFilters.groupFilter;
      if (tableState.sortKey && tableState.sortDirection) {
        params.sortBy = tableState.sortKey;
        params.sortDir = tableState.sortDirection;
      }
      const response = await productsApi.search(params);
      return {
        products: response.data.data as Product[],
        pagination: response.data.pagination,
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const products = productsData?.products ?? [];
  const pagination = productsData?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };

  const groupOptions = useMemo(() => {
    const opts = [
      { value: '', label: 'Alle varegrupper' },
      { value: '__none__', label: 'Uten varegruppe' },
    ];
    if (groups) {
      for (const g of groups) {
        opts.push({ value: g, label: g });
      }
    }
    return opts;
  }, [groups]);

  const groupColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (groups) {
      groups.forEach((g, i) => map.set(g, i % BADGE_COLORS.length));
    }
    return map;
  }, [groups]);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
    syncUrl(1, draftFilters, tableState.sortKey, tableState.sortDirection);
  }, [draftFilters, syncUrl, tableState.sortDirection, tableState.sortKey]);

  const handleReset = useCallback(() => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    syncUrl(1, EMPTY_FILTERS, tableState.sortKey, tableState.sortDirection);
  }, [syncUrl, tableState.sortDirection, tableState.sortKey]);

  const showSkeleton = isLoading && !productsData;
  const showRefetchBar = isFetching && !!productsData;

  const priceMutation = useMutation({
    mutationFn: ({ varekode, base_price }: { varekode: string; base_price: number }) =>
      productsApi.updateBasePrice(varekode, base_price),
    onSuccess: (_data, variables) => {
      toast.success(`Pris oppdatert for ${variables.varekode}`);
      setEditingPrice(null);
      void queryClient.invalidateQueries({ queryKey: productKeys.root() });
      void queryClient.invalidateQueries({ queryKey: kundeKeys.catalogRoot() });
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere pris')),
  });

  const submitPriceEdit = () => {
    if (!editingPrice) return;
    const value = parseFloat(editingPrice.value.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Ugyldig pris');
      return;
    }
    priceMutation.mutate({ varekode: editingPrice.product.varekode, base_price: value });
  };

  const hasActiveFilters = Boolean(appliedFilters.search.trim() || appliedFilters.groupFilter);
  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste produkter.';

  const columns = useMemo(
    () => [
      {
        key: 'varekode',
        header: 'Varekode',
        hideable: false,
      },
      {
        key: 'varenavn',
        header: 'Varenavn',
      },
      {
        key: 'varegruppe',
        header: 'Varegruppe',
        render: (value: string | null) => {
          if (!value) return <span className="text-dark-600">—</span>;
          const colorIdx = groupColorIndex.get(value) ?? 0;
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${BADGE_COLORS[colorIdx]}`}
            >
              {value}
            </span>
          );
        },
      },
      {
        key: 'base_price',
        header: 'Basispris',
        render: (value: number | undefined, product: Product) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm hover:text-primary-300 transition-colors group/pr"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPrice({ product, value: String(product.base_price ?? 0) });
            }}
            title="Rediger basispris"
          >
            {formatMoneyNok(value ?? 0)}
            <Pencil className="h-3 w-3 opacity-0 group-hover/pr:opacity-100 text-primary-400" aria-hidden />
          </button>
        ),
      },
    ],
    [groupColorIndex],
  );

  return (
    <Layout title="Produkter">
      <div className="space-y-6">
        <PageHeader
          count={pagination.total}
          countLabel={`produkt${pagination.total !== 1 ? 'er' : ''}`}
          subtitle={groups ? `${groups.length} varegrupper` : undefined}
        />

        <FilterBar
          title="Søk i produkter"
          filters={draftFilters}
          onFilterChange={setDraftFilters}
          onSubmit={handleApplyFilters}
          onReset={handleReset}
          fields={[
            {
              key: 'search',
              label: 'Varekode / Navn',
              placeholder: 'Søk etter varekode eller navn...',
              colSpan: 'col-span-2',
            },
            {
              key: 'groupFilter',
              label: 'Varegruppe',
              type: 'select',
              options: groupOptions,
            },
          ]}
          gridCols="lg:grid-cols-3"
        />

        {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}
        {showRefetchBar && <QueryRefetchBar active />}

        <div className="card p-0 lg:p-0 overflow-hidden">
          {showSkeleton ? (
            <TableSkeleton rows={10} columns={3} />
          ) : isError ? null : products.length === 0 && hasActiveFilters ? (
            <EmptyState
              title="Ingen produkter matcher søket"
              description="Prøv et annet varekode, navn eller varegruppe."
              action={
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Nullstill filtre
                </button>
              }
            />
          ) : (
            <>
              <div className="flex justify-between items-center text-sm text-dark-400 px-4 py-3 border-b border-dark-800">
                <div>
                  Viser{' '}
                  {products.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
                  {Math.min(page * PAGE_SIZE, pagination.total)} av {pagination.total.toLocaleString()} produkter
                </div>
                <Pagination
                  pagination={pagination}
                  onPageChange={(p) => {
                    setPage(p);
                    syncUrl(p, appliedFilters, tableState.sortKey, tableState.sortDirection);
                  }}
                  variant="minimal"
                />
              </div>
              <DataTable
                data={products}
                columns={columns}
                rowKey={(row) => row.varekode}
                emptyMessage="Ingen produkter funnet"
                paginate={false}
                serverSort
                stickyFirstColumn
                enableColumnManagement
                enableCsvExport
                exportFilename="admin-produkter"
                title="Produkttabell"
                storageKey="table:admin-products"
                state={tableState}
                onStateChange={(next) => {
                  setTableState(next);
                  setPage(1);
                  syncUrl(1, appliedFilters, next.sortKey, next.sortDirection);
                }}
              />
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-dark-800">
                  <Pagination
                    pagination={pagination}
                    onPageChange={(p) => {
                      setPage(p);
                      syncUrl(p, appliedFilters, tableState.sortKey, tableState.sortDirection);
                    }}
                    variant="simple"
                    itemLabel="produkter"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Base price edit modal */}
        {editingPrice && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !priceMutation.isPending && setEditingPrice(null)}
              role="presentation"
            />
            <div className="relative card w-full max-w-sm z-10" role="dialog" aria-modal="true" aria-label="Rediger basispris">
              <h3 className="text-lg font-semibold mb-1">Basispris</h3>
              <p className="text-sm text-dark-400 mb-4 truncate">{editingPrice.product.varenavn || editingPrice.product.varekode}</p>
              <label className="label" htmlFor="basePriceInput">
                Pris (eks. mva)
              </label>
              <input
                id="basePriceInput"
                type="number"
                min={0}
                step="0.01"
                autoFocus
                className="input w-full mb-5"
                value={editingPrice.value}
                onChange={(e) => setEditingPrice({ ...editingPrice, value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submitPriceEdit()}
              />
              <div className="flex justify-end gap-3">
                <button type="button" className="btn-secondary" disabled={priceMutation.isPending} onClick={() => setEditingPrice(null)}>
                  Avbryt
                </button>
                <button type="button" className="btn-primary" disabled={priceMutation.isPending} onClick={submitPriceEdit}>
                  {priceMutation.isPending ? 'Lagrer…' : 'Lagre'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
