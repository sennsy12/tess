import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { PageHeader, FilterBar, TableSkeleton } from '../../components/admin';
import { productsApi } from '../../lib/api';

interface Product {
  varekode: string;
  varenavn: string;
  varegruppe: string | null;
}

const PAGE_SIZE = 25;

export function AdminProducts() {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: 'varenavn',
    sortDirection: 'asc',
    currentPage: 1,
    visibleColumnKeys: ['varekode', 'varenavn', 'varegruppe'],
  });

  const { data: productsRaw, isLoading } = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => productsApi.getAll().then((r) => r.data as Product[]),
    staleTime: 5 * 60 * 1000,
  });

  const { data: groups } = useQuery({
    queryKey: ['admin', 'product-groups'],
    queryFn: () => productsApi.getGroups().then((r) => r.data as string[]),
    staleTime: 10 * 60 * 1000,
  });

  const products = productsRaw ?? [];

  const filtered = useMemo(() => {
    let result = products;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.varekode.toLowerCase().includes(q) ||
          (p.varenavn ?? '').toLowerCase().includes(q),
      );
    }

    if (groupFilter === '__none__') {
      result = result.filter((p) => !p.varegruppe);
    } else if (groupFilter) {
      result = result.filter((p) => p.varegruppe === groupFilter);
    }

    return result;
  }, [products, search, groupFilter]);

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

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const g = p.varegruppe ?? '(ingen)';
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return counts;
  }, [products]);

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

  const groupColorIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (groups) {
      groups.forEach((g, i) => map.set(g, i % BADGE_COLORS.length));
    }
    return map;
  }, [groups]);

  const columns = [
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
  ];

  return (
    <Layout title="Produkter">
      <div className="space-y-6">
        <PageHeader
          count={filtered.length}
          countLabel={`produkt${filtered.length !== 1 ? 'er' : ''}`}
          subtitle={`${groupCounts.size} varegrupper`}
        />

        <FilterBar
          title="Søk i produkter"
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

        <div className="card p-0 lg:p-0 overflow-hidden">
          {isLoading ? (
            <TableSkeleton rows={10} columns={3} />
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(row) => row.varekode}
              emptyMessage="Ingen produkter funnet"
              pageSize={PAGE_SIZE}
              stickyFirstColumn
              enableColumnManagement
              enableCsvExport
              exportFilename="admin-produkter"
              title="Produkttabell"
              storageKey="table:admin-products"
              state={tableState}
              onStateChange={setTableState}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
