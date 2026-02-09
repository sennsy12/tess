import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { AutocompleteInput } from '../../components/AutocompleteInput';
import { FilterBar, Pagination, TableSkeleton } from '../../components/admin';
import { ordersApi, suggestionsApi } from '../../lib/api';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Order {
  ordrenr: number;
  dato: string;
  kundenr: string;
  kundenavn: string;
  firmanavn: string;
  lagernavn: string;
  valutaid: string;
  sum: number;
  kunderef?: string;
  kundeordreref?: string;
}

interface Suggestion {
  suggestion: string;
  type: string;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function AdminOrders() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    ordrenr: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const navigate = useNavigate();

  // ── Data fetching ─────────────────────────────────────
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page, filters],
    queryFn: async () => {
      const queryParams = { ...filters, page, limit: PAGE_LIMIT };
      const response = await ordersApi.getAll(queryParams);
      if (response.data.data) {
        return {
          orders: response.data.data as Order[],
          total: response.data.total as number,
        };
      }
      return {
        orders: response.data as Order[],
        total: (response.data as Order[]).length,
      };
    },
  });

  const orders = ordersData?.orders ?? [];
  const total = ordersData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  // ── Suggestions (autocomplete) ────────────────────────
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
      setFilters((prev) => ({ ...prev, search: suggestion.suggestion }));
      setPage(1);
    },
    [],
  );

  // ── Filter handlers ───────────────────────────────────
  const handleReset = useCallback(() => {
    setFilters({ ordrenr: '', startDate: '', endDate: '', search: '' });
    setPage(1);
  }, []);

  // ── Render ────────────────────────────────────────────
  return (
    <Layout title="Admin Ordrer">
      <div className="space-y-6">
        {/* Search filters */}
        <FilterBar
          title="Søk i ordrer"
          filters={filters}
          onFilterChange={setFilters}
          onSubmit={() => setPage(1)}
          onReset={handleReset}
          fields={[...FILTER_FIELDS]}
        >
          {/* Custom autocomplete field in the extra slot */}
          <div>
            <label className="label">Fritekst søk</label>
            <AutocompleteInput
              value={filters.search}
              onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
              onSelect={handleSuggestionSelect}
              fetchSuggestions={fetchSuggestions}
              placeholder="Søk kunde, ref, produkt..."
              minChars={3}
            />
          </div>
        </FilterBar>

        {/* Results */}
        {isLoading ? (
          <div className="card p-0 lg:p-0 overflow-hidden">
            <TableSkeleton rows={10} columns={8} />
          </div>
        ) : (
          <>
            {/* Top summary + pagination */}
            <div className="flex justify-between items-center text-sm text-dark-400">
              <div>
                Viser{' '}
                {orders.length > 0 ? (page - 1) * PAGE_LIMIT + 1 : 0} -{' '}
                {Math.min(page * PAGE_LIMIT, total)} av {total} ordrer
              </div>
              <Pagination
                pagination={{ page, total, limit: PAGE_LIMIT, totalPages }}
                onPageChange={setPage}
                variant="minimal"
              />
            </div>

            <DataTable
              data={orders}
              columns={COLUMNS}
              onRowClick={(order) => navigate(`/admin/orders/${order.ordrenr}`)}
              emptyMessage="Ingen ordrer funnet"
            />

            {/* Bottom pagination (full variant) */}
            <Pagination
              pagination={{ page, total, limit: PAGE_LIMIT, totalPages }}
              onPageChange={setPage}
              variant="simple"
              className="justify-center"
            />
          </>
        )}
      </div>
    </Layout>
  );
}
