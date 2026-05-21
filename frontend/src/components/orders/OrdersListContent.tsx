import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../DataTable';
import { AutocompleteInput } from '../AutocompleteInput';
import { SavedViewsPanel } from '../SavedViewsPanel';
import { FilterBar, Pagination, TableSkeleton } from '../admin';
import { QueryErrorBanner } from '../QueryErrorBanner';
import { QueryRefetchBar } from '../QueryRefetchBar';
import { ActiveFilterChips } from '../ActiveFilterChips';
import { EmptyState } from '../EmptyState';
import { OrderWorkflowBadge } from './OrderWorkflowBadge';
import { OrderMobileCard } from './OrderMobileCard';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useServerListPage } from '../../hooks/useServerListPage';
import { ordersApi, suggestionsApi } from '../../lib/api';
import { buildOrderFilterChips, clearOrderFilter } from '../../lib/orderFilterChips';
import { orderKeys, type OrderFilters } from '../../lib/queryKeys';
import { orderFiltersFromSearchParams, orderFiltersToSearchParams } from '../../lib/listPageUrl';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../../types/notification';
import type { Suggestion } from '../../types/order';

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
    key: 'workflow_status',
    header: 'Status',
    render: (value: string) => <OrderWorkflowBadge status={value} />,
  },
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

const EMPTY_FILTERS: OrderFilters = {
  ordrenr: '',
  startDate: '',
  endDate: '',
  search: '',
  workflowStatus: '',
};

const WORKFLOW_FILTER_OPTIONS: { value: OrderWorkflowStatus | ''; label: string }[] = [
  { value: '', label: 'Alle statuser' },
  ...(Object.entries(ORDER_WORKFLOW_LABELS) as [OrderWorkflowStatus, string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

export interface OrdersListContentProps {
  variant: 'admin' | 'kunde';
}

export function OrdersListContent({ variant }: OrdersListContentProps) {
  const navigate = useNavigate();
  const isAdmin = variant === 'admin';
  const hasAppliedDefaultView = useRef(false);

  const {
    page,
    setPage,
    draftFilters,
    setDraftFilters,
    appliedFilters,
    tableState,
    setTableState,
    handleTableStateChange,
    handleApplyFilters,
    handleReset,
    applyFilters,
    data: ordersData,
    isError,
    error,
    refetch,
    showSkeleton,
    showRefetchBar,
  } = useServerListPage<OrderFilters, { orders: unknown[]; total: number }>({
    queryKey: (p, filters, sortKey, sortDirection) =>
      orderKeys.list(variant, p, filters, sortKey, sortDirection),
    queryFn: async ({ page: p, filters, sortKey, sortDirection }) => {
      const queryParams: Record<string, string | number> = {
        ...filters,
        page: p,
        limit: PAGE_LIMIT,
      };
      if (isAdmin && sortKey && sortDirection) {
        queryParams.sortBy = sortKey;
        queryParams.sortDir = sortDirection;
      }
      if (filters.workflowStatus) {
        queryParams.workflowStatus = filters.workflowStatus;
      }
      const response = await ordersApi.getAll(queryParams);
      return {
        orders: response.data.data ?? [],
        total: response.data.pagination?.total ?? 0,
      };
    },
    defaultFilters: EMPTY_FILTERS,
    defaultVisibleColumns: COLUMNS.map((c) => String(c.key)),
    pageSize: PAGE_LIMIT,
    staleTime: 60_000,
    resetPageOnSort: isAdmin,
    urlSync: {
      read: orderFiltersFromSearchParams,
      write: orderFiltersToSearchParams,
    },
  });

  const orders = ordersData?.orders ?? [];
  const total = ordersData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const ordersViewState = { filters: appliedFilters, page, tableState };

  const {
    views,
    defaultView,
    canUseShared,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: isAdmin ? 'admin-orders' : 'kunde-orders',
    state: ordersViewState,
    enabledShared: isAdmin,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    const viewState = defaultView.state;
    setDraftFilters(viewState.filters);
    applyFilters(viewState.filters);
    setPage(viewState.page ?? 1);
    setTableState(viewState.tableState);
  }, [defaultView, applyFilters, setDraftFilters, setPage, setTableState]);

  const fetchSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
    try {
      const response = await suggestionsApi.search(query);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const handleSuggestionSelect = useCallback(
    (suggestion: Suggestion) => {
      applyFilters({ ...appliedFilters, search: suggestion.suggestion });
    },
    [appliedFilters, applyFilters],
  );

  const filterChips = buildOrderFilterChips(appliedFilters);
  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste ordrer.';

  const orderDetailPath = (ordrenr: number) =>
    isAdmin ? `/admin/orders/${ordrenr}` : `/kunde/orders/${ordrenr}`;

  return (
    <div className="space-y-6">
      <SavedViewsPanel
        title={isAdmin ? 'Arbeidsflater' : 'Mine arbeidsflater'}
        description={
          isAdmin
            ? 'Lagre filter, sortering og kolonneoppsett. Delte visninger kan brukes av andre administratorer.'
            : 'Lagre søk, sortering og kolonneoppsett for orderoversikten.'
        }
        views={views}
        isLoading={viewsLoading}
        canShare={canUseShared}
        onApply={(view) => {
          setDraftFilters(view.state.filters);
          applyFilters(view.state.filters);
          setPage(view.state.page ?? 1);
          setTableState(view.state.tableState);
        }}
        onSave={(name, options) => saveView(name, options)}
        onDelete={(view) => deleteView(view)}
        onSetDefault={setDefaultView}
      />

      <FilterBar
        title="Søk i ordrer"
        filters={draftFilters}
        onFilterChange={setDraftFilters}
        onSubmit={handleApplyFilters}
        onReset={handleReset}
        fields={[...FILTER_FIELDS]}
      >
        <div>
          <label className="label">Fritekst søk</label>
          <AutocompleteInput
            value={draftFilters.search}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, search: value }))}
            onSelect={handleSuggestionSelect}
            fetchSuggestions={fetchSuggestions}
            placeholder="Søk kundenr, henvisning, ref, kunde..."
            minChars={3}
          />
        </div>
        <div>
          <label className="label" htmlFor="workflowStatus">
            Ordrestatus
          </label>
          <select
            id="workflowStatus"
            className="input w-full"
            value={draftFilters.workflowStatus}
            onChange={(e) =>
              setDraftFilters((prev) => ({ ...prev, workflowStatus: e.target.value }))
            }
          >
            {WORKFLOW_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      <ActiveFilterChips
        chips={filterChips}
        onRemove={(id) => {
          const next = clearOrderFilter(appliedFilters, id);
          setDraftFilters(next);
          applyFilters(next);
        }}
        onClearAll={handleReset}
      />

      {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}

      {showRefetchBar && <QueryRefetchBar active />}

      {showSkeleton ? (
        <div className="card p-0 lg:p-0 overflow-hidden">
          <TableSkeleton rows={10} columns={8} />
        </div>
      ) : isError ? null : orders.length === 0 && filterChips.length > 0 ? (
        <EmptyState
          title="Ingen ordrer matcher filtrene"
          description="Prøv å justere søk eller datoperiode."
          action={
            <button type="button" className="btn-secondary" onClick={handleReset}>
              Nullstill filtre
            </button>
          }
        />
      ) : (
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

          {!isAdmin && (
            <div className="space-y-3 lg:hidden">
              {(orders as {
                ordrenr: number;
                dato: string;
                sum: number;
                firmanavn?: string;
                kunderef?: string;
                kundeordreref?: string;
                workflow_status?: string;
              }[]).map((order) => (
                <OrderMobileCard
                  key={order.ordrenr}
                  order={order}
                  onClick={() => navigate(orderDetailPath(order.ordrenr))}
                />
              ))}
            </div>
          )}

          <div className={isAdmin ? undefined : 'hidden lg:block'}>
            <DataTable
              data={orders as Record<string, unknown>[]}
              columns={COLUMNS}
              onRowClick={(order) => navigate(orderDetailPath((order as { ordrenr: number }).ordrenr))}
              emptyMessage="Ingen ordrer funnet"
              paginate={false}
              serverSort={isAdmin}
              stickyFirstColumn
              enableColumnManagement
              enableCsvExport
              exportFilename={`${variant}-orders`}
              title="Ordretabell"
              storageKey={`table:${variant}-orders`}
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
      )}
    </div>
  );
}
