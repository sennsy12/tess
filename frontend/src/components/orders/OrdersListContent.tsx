import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw } from 'lucide-react';
import { DataTable } from '../DataTable';
import { AutocompleteInput } from '../AutocompleteInput';
import { SavedViewsPanel } from '../SavedViewsPanel';
import { Pagination, TableSkeleton } from '../admin';
import { QueryErrorBanner } from '../QueryErrorBanner';
import { QueryRefetchBar } from '../QueryRefetchBar';
import { ActiveFilterChips } from '../ActiveFilterChips';
import { EmptyState } from '../EmptyState';
import { OrderWorkflowBadge } from './OrderWorkflowBadge';
import { OrderMobileCard } from './OrderMobileCard';
import { OrderStatsStrip } from './OrderStatsStrip';
import { useSavedViews } from '../../hooks/useSavedViews';
import { useServerListPage } from '../../hooks/useServerListPage';
import { ordersApi, suggestionsApi } from '../../lib/api';
import { buildOrderFilterChips, clearOrderFilter } from '../../lib/orderFilterChips';
import { orderKeys, type OrderFilters } from '../../lib/queryKeys';
import { orderFiltersFromSearchParams, orderFiltersToSearchParams } from '../../lib/listPageUrl';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../../types/notification';
import type { Suggestion } from '../../types/order';

const PAGE_LIMIT = 50;

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
        page: p,
        limit: PAGE_LIMIT,
      };
      // Only send non-empty filters — empty strings would fail enum validation
      for (const [key, value] of Object.entries(filters)) {
        if (typeof value === 'string' && value.trim()) {
          queryParams[key] = value.trim();
        }
      }
      if (isAdmin && sortKey && sortDirection) {
        queryParams.sortBy = sortKey;
        queryParams.sortDir = sortDirection;
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
      <OrderStatsStrip
        orders={orders as { sum: number; dato: string }[]}
        total={total}
        isLoading={showSkeleton}
      />

      {/*
        Verktøylinje: alle filtre i én kompakt rad (wrapper på mobil).
        Enter eller «Bruk filtre» sender utkastet til serveren.
      */}
      <form
        className="card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleApplyFilters();
        }}
      >
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex-1 min-w-[14rem]">
            <label htmlFor="order-search" className="label text-xs">
              Fritekst søk
            </label>
            <AutocompleteInput
              value={draftFilters.search}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, search: value }))}
              onSelect={handleSuggestionSelect}
              fetchSuggestions={fetchSuggestions}
              placeholder="Søk kundenr, henvisning, ref, kunde..."
              minChars={3}
            />
          </div>

          <div className="min-w-[8rem]">
            <label htmlFor="order-ordrenr" className="label text-xs">
              Ordrenr
            </label>
            <input
              id="order-ordrenr"
              type="text"
              inputMode="numeric"
              className="input py-2"
              placeholder="F.eks. 1001"
              value={draftFilters.ordrenr}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, ordrenr: e.target.value }))}
            />
          </div>

          <div className="min-w-[9rem]">
            <label htmlFor="order-start-date" className="label text-xs">
              Fra dato
            </label>
            <input
              id="order-start-date"
              type="date"
              className="input py-2"
              value={draftFilters.startDate}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="min-w-[9rem]">
            <label htmlFor="order-end-date" className="label text-xs">
              Til dato
            </label>
            <input
              id="order-end-date"
              type="date"
              className="input py-2"
              value={draftFilters.endDate}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="min-w-[11rem]">
            <label htmlFor="workflowStatus" className="label text-xs">
              Ordrestatus
            </label>
            <select
              id="workflowStatus"
              className="input py-2"
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

          <div className="flex items-center gap-2 ml-auto">
            <button type="submit" className="btn-primary py-2 text-sm flex items-center gap-1.5">
              <Search className="h-4 w-4" aria-hidden />
              Bruk filtre
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary py-2 text-sm flex items-center gap-1.5"
              title="Nullstill alle filtre"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Nullstill
            </button>
          </div>
        </div>
      </form>

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

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-dark-400">
            <div>
              Viser {orders.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0} -{' '}
              {Math.min(page * PAGE_LIMIT, total)} av {total} ordrer
            </div>
            <Pagination
              pagination={{ page, total, limit: PAGE_LIMIT, totalPages }}
              onPageChange={setPage}
              variant="simple"
            />
          </div>
        </>
      )}

      {/* Lagrede visninger nederst – sammenleggbar og utenfor hovedflyten */}
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
    </div>
  );
}
