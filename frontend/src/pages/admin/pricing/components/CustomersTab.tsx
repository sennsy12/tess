import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { pricingApi } from '../../../../lib/api';
import { CustomerWithGroup, CustomersTabProps } from '../../../../types/pricing';
import { Pagination } from '../../../../components/admin';
import { Spinner } from '../../../../components/Spinner';
import { PaginationInfo } from '../../../../types/statistics';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function CustomersTab({
  groups,
  handleAssignCustomer,
  initialState,
  onStateChange,
}: CustomersTabProps) {
  const [customers, setCustomers] = useState<CustomerWithGroup[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    if (!initialState) return;
    setSearch(initialState.search);
    setFilterGroup(initialState.filterGroup);
    setPageSize(initialState.pageSize);
  }, [initialState]);

  useEffect(() => {
    onStateChange?.({
      search,
      filterGroup,
      pageSize,
    });
  }, [filterGroup, onStateChange, pageSize, search]);

  // Fetch data from backend whenever filters/page change
  const fetchCustomers = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterGroup !== 'all') params.group = filterGroup;

      const res = await pricingApi.searchCustomers(params);
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error('Failed to search customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterGroup, pageSize]);

  // Reset to page 1 when filters change, then fetch
  useEffect(() => {
    fetchCustomers(1);
  }, [debouncedSearch, filterGroup, pageSize]);

  const goToPage = (page: number) => {
    fetchCustomers(page);
  };

  // After assigning, refetch current page to reflect the change
  const handleAssign = async (kundenr: string, groupId: number | null) => {
    try {
      await handleAssignCustomer(kundenr, groupId);
      toast.success(groupId ? 'Kunde tildelt gruppe' : 'Kunde fjernet fra gruppe');
    } finally {
      void fetchCustomers(pagination.page);
    }
  };

  // Stats summary (from current pagination total + groups)
  const statsAssigned = customers.filter(c => c.customer_group_id !== null).length;

  return (
    <div className="space-y-4">
      {groups.length === 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Opprett kundegrupper først under fanen <span className="font-medium">Kundegrupper</span>, deretter kan du tildele kunder her.
        </div>
      )}
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-fade-in">
        <div className="card-interactive text-center">
          <p className="text-2xl font-bold">{pagination.total.toLocaleString()}</p>
          <p className="text-xs text-dark-400 uppercase tracking-wide mt-1">
            {debouncedSearch || filterGroup !== 'all' ? 'Treff' : 'Totalt'}
          </p>
        </div>
        <div className="card-interactive text-center">
          <p className="text-2xl font-bold text-green-400">{statsAssigned}</p>
          <p className="text-xs text-dark-400 uppercase tracking-wide mt-1">Tildelt (denne siden)</p>
        </div>
        <div className="card-interactive text-center hidden sm:block">
          <p className="text-2xl font-bold text-dark-300">{pagination.totalPages}</p>
          <p className="text-xs text-dark-400 uppercase tracking-wide mt-1">Sider</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search input */}
          <div className="flex-[2] relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk på kundenr eller kundenavn..."
              className="input pl-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-dark-400 hover:text-dark-200 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-1 gap-3">
            {/* Group filter */}
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="input flex-1 min-w-[140px]"
            >
              <option value="all">Alle grupper</option>
              <option value="unassigned">Uten gruppe</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Page size */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input w-auto min-w-[130px] whitespace-nowrap"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size} per side</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results indicator */}
        <div className="mt-3 flex items-center gap-2 text-sm text-dark-400">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner size="xs" className="text-primary-500" />
              <span>Søker...</span>
            </div>
          ) : (
            <span>
              Viser <span className="text-dark-200 font-medium">
                {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
                &ndash;
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span> av {pagination.total.toLocaleString()} kunder
              {debouncedSearch && <span> for &laquo;{debouncedSearch}&raquo;</span>}
            </span>
          )}
        </div>
      </div>

      {/* Customer table */}
      <div className="card p-0 lg:p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-dark-800/50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Kundenr</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Kundenavn</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Nåværende gruppe</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-dark-300 uppercase tracking-wider">Endre gruppe</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && customers.length === 0 ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-dark-800">
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-dark-800 rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-40 bg-dark-800 rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-dark-800 rounded animate-pulse" /></td>
                    <td className="py-3 px-4"><div className="h-8 w-36 bg-dark-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-dark-400">
                    {debouncedSearch ? (
                      <div>
                        <p className="text-lg mb-1">Ingen treff</p>
                        <p className="text-sm">Prøv et annet søkeord eller fjern filteret</p>
                      </div>
                    ) : (
                      <p>Ingen kunder funnet</p>
                    )}
                  </td>
                </tr>
              ) : (
                customers.map((customer, idx) => (
                  <tr
                    key={customer.kundenr}
                    className={`border-t border-dark-800 transition-colors hover:bg-dark-800/40 ${
                      idx % 2 === 0 ? '' : 'bg-dark-800/20'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-sm text-primary-400">{customer.kundenr}</td>
                    <td className="py-3 px-4 text-dark-100">{customer.kundenavn}</td>
                    <td className="py-3 px-4">
                      {customer.customer_group_name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-500/15 text-primary-300 border border-primary-500/30">
                          {customer.customer_group_name}
                        </span>
                      ) : (
                        <span className="text-dark-500 text-sm">Standard</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={customer.customer_group_id || ''}
                        onChange={(e) =>
                          handleAssign(customer.kundenr, e.target.value ? parseInt(e.target.value) : null)
                        }
                        className="input py-1.5 text-sm"
                      >
                        <option value="">Standard</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-dark-900/30 border-t border-dark-800 px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={goToPage}
            itemLabel="kunder"
          />
        </div>
      </div>
    </div>
  );
}
