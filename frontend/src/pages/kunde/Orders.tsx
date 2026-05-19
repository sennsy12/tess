import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { ActiveFilterChips } from '../../components/ActiveFilterChips';
import { EmptyState } from '../../components/EmptyState';
import { FilterBar, Pagination, TableSkeleton } from '../../components/admin';
import { buildOrderFilterChips, clearOrderFilter } from '../../lib/orderFilterChips';
import { useSavedViews } from '../../hooks/useSavedViews';
import { ordersApi, suggestionsApi } from '../../lib/api';
import { Suggestion } from '../../types/order';

const PAGE_LIMIT = 50;

const FILTER_FIELDS = [
  { key: 'ordrenr', label: 'Ordrenummer', placeholder: 'F.eks. 1001' },
  { key: 'startDate', label: 'Fra dato', type: 'date' as const },
  { key: 'endDate', label: 'Til dato', type: 'date' as const },
] as const;

const COLUMNS = [
  {
    key: 'ordrenr',
    header: 'Ordrenr',
    render: (value: number) => (
      <span className="font-medium text-primary-400">#{value}</span>
    ),
  },
  {
    key: 'dato',
    header: 'Dato',
    render: (value: string) => new Date(value).toLocaleDateString('nb-NO'),
  },
  { key: 'kundenavn', header: 'Kunde' },
  {
    key: 'kunderef',
    header: 'Kunderef',
    render: (value: string) => value || '-',
  },
  { key: 'firmanavn', header: 'Firma' },
  { key: 'lagernavn', header: 'Lager' },
  { key: 'valutaid', header: 'Valuta' },
  {
    key: 'sum',
    header: 'Sum',
    render: (value: number) => (
      <span className="font-semibold">
        {new Intl.NumberFormat('nb-NO', {
          style: 'currency',
          currency: 'NOK',
        }).format(value)}
      </span>
    ),
  },
];

const isSameTableState = (a: DataTableState, b: DataTableState) =>
  a.sortKey === b.sortKey &&
  a.sortDirection === b.sortDirection &&
  a.currentPage === b.currentPage &&
  a.visibleColumnKeys.length === b.visibleColumnKeys.length &&
  a.visibleColumnKeys.every((key, index) => key === b.visibleColumnKeys[index]);

export function KundeOrders() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    ordrenr: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: null,
    sortDirection: null,
    currentPage: 1,
    visibleColumnKeys: COLUMNS.map((column) => String(column.key)),
  });
  const navigate = useNavigate();
  const hasAppliedDefaultView = useRef(false);

  const ordersViewState = { filters, page, tableState };

  const {
    views,
    defaultView,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: 'kunde-orders',
    state: ordersViewState,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    const viewState = defaultView.state;
    setFilters(viewState.filters);
    setPage(viewState.page ?? 1);
    setTableState(viewState.tableState);
  }, [defaultView]);

  const handleTableStateChange = useCallback((nextState: DataTableState) => {
    setTableState((previousState) =>
      isSameTableState(previousState, nextState) ? previousState : nextState,
    );
  }, []);

  const {
    data: ordersData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['kunde', 'orders', page, filters],
    queryFn: async () => {
      const response = await ordersApi.getAll({ ...filters, page, limit: PAGE_LIMIT });
      return {
        orders: response.data.data ?? [],
        total: response.data.total ?? 0,
      };
    },
    staleTime: 60_000,
  });

  const orders = ordersData?.orders ?? [];
  const total = ordersData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const fetchSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
    try {
      const response = await suggestionsApi.search(query);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: Suggestion) => {
    setFilters((prev) => ({ ...prev, search: suggestion.suggestion }));
    setPage(1);
  }, []);

  const handleReset = useCallback(() => {
    setFilters({ ordrenr: '', startDate: '', endDate: '', search: '' });
    setPage(1);
  }, []);

  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste ordrer.';

  const filterChips = buildOrderFilterChips(filters);

  return (
    <Layout title="Ordrer">
      <div className="space-y-6">
        <SavedViewsPanel
          title="Mine arbeidsflater"
          description="Lagre søk, sortering og kolonneoppsett for orderoversikten."
          views={views}
          isLoading={viewsLoading}
          onApply={(view) => {
            setFilters(view.state.filters);
            setPage(view.state.page ?? 1);
            setTableState(view.state.tableState);
          }}
          onSave={(name, options) => saveView(name, options)}
          onDelete={(view) => deleteView(view)}
          onSetDefault={setDefaultView}
        />

        <FilterBar
          title="Søk i ordrer"
          filters={filters}
          onFilterChange={setFilters}
          onSubmit={() => setPage(1)}
          onReset={handleReset}
          fields={[...FILTER_FIELDS]}
        >
          <div>
            <label className="label">Fritekst søk</label>
            <AutocompleteInput
              value={filters.search}
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              onSelect={handleSuggestionSelect}
              fetchSuggestions={fetchSuggestions}
              placeholder="Søk kundenr, henvisning, ref, kunde..."
              minChars={3}
            />
          </div>
        </FilterBar>

        <ActiveFilterChips
          chips={filterChips}
          onRemove={(id) => {
            setFilters((prev) => clearOrderFilter(prev, id));
            setPage(1);
          }}
          onClearAll={handleReset}
        />

        {isError && (
          <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />
        )}

        {isLoading ? (
          <div className="card p-0 lg:p-0 overflow-hidden">
            <TableSkeleton rows={10} columns={8} />
          </div>
        ) : !isError && orders.length === 0 && filterChips.length > 0 ? (
          <EmptyState
            title="Ingen ordrer matcher filtrene"
            description="Prøv å justere søk eller datoperiode."
            action={
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Nullstill filtre
              </button>
            }
          />
        ) : !isError ? (
          <>
            <div className="flex justify-between items-center text-sm text-dark-400">
              <div>
                Viser {orders.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0} -{' '}
                {Math.min(page * PAGE_LIMIT, total)} av {total} ordrer
              </div>
              <Pagination
                pagination={{ page, total, limit: PAGE_LIMIT, totalPages }}
                onPageChange={setPage}
                variant="minimal"
              />
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 lg:hidden">
              {orders.map((order) => (
                <button
                  key={order.ordrenr}
                  type="button"
                  onClick={() => navigate(`/kunde/orders/${order.ordrenr}`)}
                  className="card w-full text-left transition-colors hover:bg-dark-800/50"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-primary-400">#{order.ordrenr}</span>
                    <span className="font-semibold text-sm">
                      {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(
                        order.sum,
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-dark-300 mt-1">
                    {new Date(order.dato).toLocaleDateString('nb-NO')} · {order.firmanavn || '-'}
                  </p>
                </button>
              ))}
            </div>

            <div className="hidden lg:block">
              <DataTable
                data={orders}
                columns={COLUMNS}
                onRowClick={(order) => navigate(`/kunde/orders/${order.ordrenr}`)}
                emptyMessage="Ingen ordrer funnet"
                paginate={false}
                stickyFirstColumn
                enableColumnManagement
                enableCsvExport
                exportFilename="kunde-orders"
                title="Ordretabell"
                storageKey="table:kunde-orders"
                state={tableState}
                onStateChange={handleTableStateChange}
              />
            </div>

            <Pagination
              pagination={{ page, total, limit: PAGE_LIMIT, totalPages }}
              onPageChange={setPage}
              variant="simple"
              className="justify-center"
            />
          </>
        ) : null}
      </div>
    </Layout>
  );
}
