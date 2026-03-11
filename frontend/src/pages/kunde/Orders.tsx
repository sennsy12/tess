import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { SavedViewsPanel } from '../../components/SavedViewsPanel';
import { useSavedViews } from '../../hooks/useSavedViews';
import { ordersApi, suggestionsApi } from '../../lib/api';
import { TableSkeleton } from '../../components/admin';

import { Order, Suggestion } from '../../types/order';

export function KundeOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  
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
    visibleColumnKeys: ['ordrenr', 'dato', 'kundenavn', 'kunderef', 'firmanavn', 'lagernavn', 'valutaid', 'sum'],
  });
  const navigate = useNavigate();
  const hasAppliedDefaultView = useRef(false);

  useEffect(() => {
    loadOrders();
  }, [page]);

  const loadOrders = async (params?: Record<string, any>) => {
    setIsLoading(true);
    try {
      // Merge current filters with new params and pagination
      const queryParams = { 
        ...filters, 
        ...params,
        page, 
        limit 
      };
      
      // If we are searching (params provided), we might want to reset page to 1
      // But since this function is also called by useEffect[page], we need to be careful.
      // For now, handleSearch will handle page reset.

      const response = await ordersApi.getAll(queryParams);
      
      setOrders(response.data.data ?? []);
      setTotal(response.data.total ?? 0);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized fetch function for autocomplete
  const fetchSuggestions = useCallback(async (query: string): Promise<Suggestion[]> => {
    try {
      const response = await suggestionsApi.search(query);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      return [];
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
    loadOrders({ page: 1 }); // Force load with page 1
  };

  const handleReset = () => {
    setFilters({ ordrenr: '', startDate: '', endDate: '', search: '' });
    setPage(1);
    loadOrders({ ordrenr: '', startDate: '', endDate: '', search: '', page: 1 });
  };

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    // When a suggestion is selected, trigger search automatically
    const params: Record<string, any> = { search: suggestion.suggestion };
    setFilters(prev => ({ ...prev, search: suggestion.suggestion }));
    setPage(1);
    loadOrders({ ...params, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / limit)) {
      setPage(newPage);
      // useEffect will trigger loadOrders
    }
  };

  const columns = [
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
          {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(value)}
        </span>
      ),
    },
  ];

  const currentViewState = {
    filters,
    page,
    tableState,
  };

  const {
    views,
    defaultView,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: 'kunde-orders',
    state: currentViewState,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    setFilters(defaultView.state.filters);
    setPage(defaultView.state.page ?? 1);
    setTableState(defaultView.state.tableState);
  }, [defaultView]);

  const totalPages = Math.ceil(total / limit);

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

        {/* Search filters */}
        <form onSubmit={handleSearch} className="card">
          <h3 className="text-lg font-semibold mb-4">Søk i ordrer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Ordrenummer</label>
              <input
                type="text"
                value={filters.ordrenr}
                onChange={(e) => setFilters({ ...filters, ordrenr: e.target.value })}
                className="input"
                placeholder="F.eks. 1001"
              />
            </div>
            <div>
              <label className="label">Fra dato</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Til dato</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Fritekst søk</label>
              <AutocompleteInput
                value={filters.search}
                onChange={(value) => setFilters({ ...filters, search: value })}
                onSelect={handleSuggestionSelect}
                fetchSuggestions={fetchSuggestions}
                placeholder="Søk kundenr, henvisning, ref, kunde..."
                minChars={3}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="btn-primary">
              🔍 Søk
            </button>
            <button type="button" onClick={handleReset} className="btn-secondary">
              ↻ Nullstill
            </button>
          </div>
        </form>

        {/* Results */}
        {isLoading ? (
          <div className="card p-0 lg:p-0 overflow-hidden">
            <TableSkeleton rows={10} columns={8} />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center text-sm text-dark-400">
              <div>
                Viser {orders.length > 0 ? (page - 1) * limit + 1 : 0} - {Math.min(page * limit, total)} av {total} ordrer
              </div>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Forrige
                  </button>
                  <span className="px-3 py-1">
                    Side {page} av {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Neste
                  </button>
                </div>
              )}
            </div>
            <DataTable
              data={orders}
              columns={columns}
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
              onStateChange={setTableState}
            />
            
            {/* Bottom Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Forrige
                </button>
                <span className="px-4 py-2">
                  Side {page} av {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Neste
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
