import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { PageHeader, FilterBar, TableSkeleton, Pagination } from '../../components/admin';
import { customersApi, pricingApi, ordersApi } from '../../lib/api';
import type { Order } from '../../types/order';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Customer {
  kundenr: string;
  kundenavn: string;
  customer_group_id: number | null;
}

interface CustomerGroup {
  id: number;
  name: string;
}

const PAGE_SIZE = 25;
const ORDERS_PAGE_SIZE = 20;

const NOK = new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' });

// ────────────────────────────────────────────────────────────
// Customer Orders Modal
// ────────────────────────────────────────────────────────────

function CustomerOrdersModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [ordrenrFilter, setOrdrenrFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filters = useMemo(
    () => ({
      kundenr: customer.kundenr,
      ordrenr: ordrenrFilter,
      startDate,
      endDate,
      page,
      limit: ORDERS_PAGE_SIZE,
    }),
    [customer.kundenr, ordrenrFilter, startDate, endDate, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'customer-orders', filters],
    queryFn: () => ordersApi.getAll(filters).then((r) => r.data),
  });

  const orders: Order[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / ORDERS_PAGE_SIZE);

  const handleReset = useCallback(() => {
    setOrdrenrFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }, []);

  const totalSum = useMemo(
    () => orders.reduce((s, o) => s + (o.sum ?? 0), 0),
    [orders],
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">
              Ordrer for {customer.kundenavn || customer.kundenr}
            </h3>
            <p className="text-sm text-dark-400 mt-0.5">
              Kundenr: {customer.kundenr}
              {!isLoading && (
                <span className="ml-3">
                  {total} ordre{total !== 1 ? 'r' : ''} totalt
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-dark-800/50 flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Ordrenummer</label>
              <input
                type="text"
                value={ordrenrFilter}
                onChange={(e) => { setOrdrenrFilter(e.target.value); setPage(1); }}
                className="input w-full"
                placeholder="F.eks. 1001"
              />
            </div>
            <div>
              <label className="label">Fra dato</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Til dato</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="input w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="btn-secondary text-sm py-2 px-3"
              >
                Nullstill
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={6} columns={6} />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-dark-400">
              <p className="text-lg">Ingen ordrer funnet</p>
              <p className="text-sm mt-1">Prøv å endre filtrene</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-dark-900 border-b border-dark-800">
                <tr>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Ordrenr</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Dato</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Kunderef</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Firma</th>
                  <th className="text-left px-4 py-3 text-dark-400 font-medium">Lager</th>
                  <th className="text-right px-4 py-3 text-dark-400 font-medium">Sum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800/50">
                {orders.map((order) => (
                  <tr
                    key={order.ordrenr}
                    onClick={() => navigate(`/admin/orders/${order.ordrenr}`)}
                    className="hover:bg-dark-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-primary-400">#{order.ordrenr}</span>
                    </td>
                    <td className="px-4 py-3 text-dark-300">
                      {new Date(order.dato).toLocaleDateString('nb-NO')}
                    </td>
                    <td className="px-4 py-3 text-dark-300">{order.kunderef || '—'}</td>
                    <td className="px-4 py-3 text-dark-300">{order.firmanavn || '—'}</td>
                    <td className="px-4 py-3 text-dark-300">{order.lagernavn || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{NOK.format(order.sum)}</td>
                  </tr>
                ))}
              </tbody>
              {orders.length > 0 && (
                <tfoot className="border-t border-dark-700 bg-dark-900/50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-dark-400 font-medium text-right">
                      Sum denne siden:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {NOK.format(totalSum)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Footer pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-dark-800 flex-shrink-0">
            <Pagination
              pagination={{ page, total, limit: ORDERS_PAGE_SIZE, totalPages }}
              onPageChange={setPage}
              variant="simple"
              itemLabel="ordrer"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────

export function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: 'kundenavn',
    sortDirection: 'asc',
    currentPage: 1,
    visibleColumnKeys: ['kundenr', 'kundenavn', 'group', 'orders'],
  });

  const {
    data: customersRaw,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: () => customersApi.getAll().then((r) => r.data as Customer[]),
    staleTime: 5 * 60 * 1000,
  });

  const { data: groups } = useQuery({
    queryKey: ['admin', 'customer-groups'],
    queryFn: () => pricingApi.getGroups().then((r) => (r.data?.data ?? r.data) as CustomerGroup[]),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customersWithGroups } = useQuery({
    queryKey: ['admin', 'customers-with-groups'],
    queryFn: () => pricingApi.getCustomersWithGroups().then((r) => r.data as Customer[]),
    staleTime: 5 * 60 * 1000,
  });

  const customers = customersWithGroups ?? customersRaw ?? [];

  const groupMap = useMemo(() => {
    const map = new Map<number, string>();
    if (groups) {
      for (const g of groups) map.set(g.id, g.name);
    }
    return map;
  }, [groups]);

  const filtered = useMemo(() => {
    let result = customers;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.kundenr.toLowerCase().includes(q) ||
          (c.kundenavn ?? '').toLowerCase().includes(q),
      );
    }

    if (groupFilter === 'none') {
      result = result.filter((c) => !c.customer_group_id);
    } else if (groupFilter === 'any') {
      result = result.filter((c) => !!c.customer_group_id);
    } else if (groupFilter) {
      result = result.filter((c) => c.customer_group_id === Number(groupFilter));
    }

    return result;
  }, [customers, search, groupFilter]);

  const groupOptions = useMemo(() => {
    const opts = [
      { value: '', label: 'Alle' },
      { value: 'any', label: 'Har prisgruppe' },
      { value: 'none', label: 'Uten prisgruppe' },
    ];
    if (groups) {
      for (const g of groups) {
        opts.push({ value: String(g.id), label: g.name });
      }
    }
    return opts;
  }, [groups]);

  const assignedCount = customers.filter((c) => c.customer_group_id).length;

  const hasActiveFilters = Boolean(search.trim() || groupFilter);
  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste kunder.';

  const columns = [
    {
      key: 'kundenr',
      header: 'Kundenr',
      hideable: false,
      render: (value: string) => (
        <Link
          to={`/admin/orders?kundenr=${encodeURIComponent(value)}`}
          className="font-medium text-primary-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </Link>
      ),
    },
    {
      key: 'kundenavn',
      header: 'Kundenavn',
    },
    {
      key: 'group',
      header: 'Prisgruppe',
      render: (_: unknown, row: Customer) => {
        if (!row.customer_group_id) {
          return <span className="text-dark-600">—</span>;
        }
        const name = groupMap.get(row.customer_group_id) ?? `#${row.customer_group_id}`;
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-primary-500/10 text-primary-400 border-primary-500/30">
            {name}
          </span>
        );
      },
      csvValue: (_: unknown, row: Customer) =>
        row.customer_group_id ? groupMap.get(row.customer_group_id) ?? '' : '',
    },
    {
      key: 'orders',
      header: '',
      sortable: false,
      align: 'right' as const,
      hideable: false,
      render: (_: unknown, row: Customer) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCustomer(row);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 hover:bg-dark-700 text-dark-200 transition-colors"
        >
          Se ordrer
        </button>
      ),
      csvValue: () => '',
    },
  ];

  return (
    <Layout title="Kunder">
      <div className="space-y-6">
        <PageHeader
          count={filtered.length}
          countLabel={`kunde${filtered.length !== 1 ? 'r' : ''}`}
          subtitle={`${assignedCount} av ${customers.length} har prisgruppe`}
        />

        <FilterBar
          title="Søk i kunder"
          filters={{ search, groupFilter }}
          onFilterChange={(f) => {
            setSearch(f.search);
            setGroupFilter(f.groupFilter);
          }}
          onSubmit={() => setTableState((s) => ({ ...s, currentPage: 1 }))}
          onReset={() => {
            setSearch('');
            setGroupFilter('');
            setTableState((s) => ({ ...s, currentPage: 1 }));
          }}
          fields={[
            {
              key: 'search',
              label: 'Kundenr / Navn',
              placeholder: 'Søk etter kundenr eller navn...',
              colSpan: 'col-span-2',
            },
            {
              key: 'groupFilter',
              label: 'Prisgruppe',
              type: 'select',
              options: groupOptions,
            },
          ]}
          gridCols="lg:grid-cols-3"
        />

        {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}

        <div className="card p-0 lg:p-0 overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={10} columns={4} />
          ) : isError ? null : filtered.length === 0 && hasActiveFilters ? (
            <EmptyState
              title="Ingen kunder matcher søket"
              description="Prøv et annet kundenr, navn eller prisgruppe."
              action={
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearch('');
                    setGroupFilter('');
                  }}
                >
                  Nullstill filtre
                </button>
              }
            />
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(row) => row.kundenr}
              emptyMessage="Ingen kunder funnet"
              pageSize={PAGE_SIZE}
              stickyFirstColumn
              enableColumnManagement
              enableCsvExport
              exportFilename="admin-kunder"
              title="Kundetabell"
              storageKey="table:admin-customers"
              state={tableState}
              onStateChange={setTableState}
            />
          )}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerOrdersModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </Layout>
  );
}
