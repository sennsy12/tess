import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Layout } from '../../components/Layout';
import { FormField } from '../../components/FormField';
import { DataTable } from '../../components/DataTable';
import { Pagination, FormModal, TableSkeleton } from '../../components/admin';
import { ordersApi, orderlinesApi, productsApi } from '../../lib/api';
import { orderLineKeys } from '../../lib/queryKeys';
import { parseBoundedInt } from '../../lib/formatters';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { OrderLine, Order } from '../../types/order';

const PAGE_SIZE = 50;

const INITIAL_FORM = {
  varekode: '',
  antall: 1,
  enhet: 'stk',
  nettpris: 0,
  linjestatus: 1,
};

export function AdminOrderLines() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const debouncedProductSearch = useDebouncedValue(productSearch, 300);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const ordersQuery = useQuery({
    queryKey: orderLineKeys.orders(),
    queryFn: async () => {
      const ordersRes = await ordersApi.getAll({ limit: 100, page: 1 });
      return (ordersRes.data.data ?? []) as Order[];
    },
  });

  useEffect(() => {
    if (selectedOrder != null || !ordersQuery.data?.length) return;
    setSelectedOrder(ordersQuery.data[0].ordrenr);
  }, [ordersQuery.data, selectedOrder]);

  const linesQuery = useQuery({
    queryKey: orderLineKeys.lines(selectedOrder ?? 0, currentPage),
    queryFn: async () => {
      const response = await orderlinesApi.getByOrder(selectedOrder!, {
        page: currentPage,
        limit: PAGE_SIZE,
      });
      return {
        lines: response.data.data as OrderLine[],
        pagination: response.data.pagination,
      };
    },
    enabled: selectedOrder != null,
  });

  const productsQuery = useQuery({
    queryKey: orderLineKeys.productSearch(debouncedProductSearch),
    queryFn: async () => {
      const response = await productsApi.search({
        search: debouncedProductSearch.trim() || undefined,
        page: 1,
        limit: 50,
        sortBy: 'varenavn',
        sortDir: 'asc',
      });
      return (response.data.data ?? []) as { varekode: string; varenavn: string }[];
    },
    enabled: showModal,
  });

  const invalidateLines = () => {
    if (selectedOrder == null) return;
    void queryClient.invalidateQueries({ queryKey: orderLineKeys.linesRoot(selectedOrder) });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingLine) {
        await orderlinesApi.update(editingLine.ordrenr!, editingLine.linjenr, formData);
      } else {
        await orderlinesApi.create({ ordrenr: selectedOrder, ...formData });
      }
    },
    onSuccess: () => {
      setShowModal(false);
      invalidateLines();
    },
    onError: () => toast.error('Kunne ikke lagre ordrelinje'),
  });

  const deleteMutation = useMutation({
    mutationFn: (line: OrderLine) => orderlinesApi.delete(line.ordrenr!, line.linjenr),
    onSuccess: () => invalidateLines(),
    onError: () => toast.error('Kunne ikke slette ordrelinje'),
  });

  const handlePageChange = useCallback(
    (newPage: number) => {
      setCurrentPage(newPage);
    },
    [],
  );

  const handleCreate = useCallback(() => {
    setEditingLine(null);
    setProductSearch('');
    setFormData({ ...INITIAL_FORM, varekode: '' });
    setShowModal(true);
  }, []);

  const handleEdit = useCallback((line: OrderLine) => {
    setEditingLine(line);
    setProductSearch(line.varekode);
    setFormData({
      varekode: line.varekode,
      antall: line.antall,
      enhet: line.enhet,
      nettpris: line.nettpris,
      linjestatus: line.linjestatus,
    });
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    (line: OrderLine) => {
      if (!confirm('Er du sikker på at du vil slette denne linjen?')) return;
      deleteMutation.mutate(line);
    },
    [deleteMutation],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      saveMutation.mutate();
    },
    [saveMutation],
  );

  const columns = [
    { key: 'linjenr', header: 'Linje' },
    { key: 'varekode', header: 'Varekode' },
    { key: 'varenavn', header: 'Varenavn' },
    { key: 'antall', header: 'Antall' },
    { key: 'enhet', header: 'Enhet' },
    {
      key: 'nettpris',
      header: 'Pris',
      render: (value: number) =>
        new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(value),
    },
    {
      key: 'linjesum',
      header: 'Sum',
      render: (value: number) => (
        <span className="font-semibold">
          {new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(value)}
        </span>
      ),
    },
    {
      key: 'linjestatus',
      header: 'Status',
      csvValue: (value: number) => (value === 1 ? 'Aktiv' : 'Inaktiv'),
      render: (value: number) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            value === 1
              ? 'bg-green-600/20 text-green-300'
              : 'bg-dark-600/40 text-dark-300'
          }`}
        >
          {value === 1 ? 'Aktiv' : 'Inaktiv'}
        </span>
      ),
    },
    {
      key: 'henvisning1',
      header: 'Henvisninger',
      csvValue: (_: unknown, row: OrderLine) => {
        const refs = [row.henvisning1, row.henvisning2, row.henvisning3, row.henvisning4, row.henvisning5].filter(Boolean);
        return refs.join('; ');
      },
      render: (_: unknown, row: OrderLine) => {
        const refs = [
          row.henvisning1,
          row.henvisning2,
          row.henvisning3,
          row.henvisning4,
          row.henvisning5,
        ].filter(Boolean);
        if (refs.length === 0) return <span className="text-dark-500">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {refs.map((ref, i) => (
              <span key={i} className="inline-block px-2 py-0.5 bg-dark-700 rounded text-xs">
                {ref}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Handlinger',
      sortable: false,
      hideable: true,
      csvValue: () => '',
      render: (_: unknown, row: OrderLine) => (
        <div className="flex gap-2">
          <button type="button" onClick={() => handleEdit(row)} className="text-primary-400 hover:text-primary-300">
            Rediger
          </button>
          <button type="button" onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-300">
            Slett
          </button>
        </div>
      ),
    },
  ];

  const orders = ordersQuery.data ?? [];
  const orderLines = linesQuery.data?.lines ?? [];
  const paginationInfo = linesQuery.data?.pagination ?? null;
  const productOptions = productsQuery.data ?? [];
  const isLoading = ordersQuery.isLoading;

  return (
    <Layout title="Ordrelinjer">
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {isLoading ? (
                <div className="animate-pulse rounded bg-dark-700/60 h-10 w-full" />
              ) : (
                <div className="flex gap-2">
                  <FormField label="Ordrenr" htmlFor="orderlines-ordrenr">
                    <input
                      id="orderlines-ordrenr"
                      type="number"
                      value={selectedOrder || ''}
                      onChange={(e) => {
                        setSelectedOrder(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="input w-32"
                      placeholder="Ordrenr"
                    />
                  </FormField>
                  <FormField label="Velg fra liste" htmlFor="orderlines-select" className="flex-1">
                    <select
                      id="orderlines-select"
                      value={selectedOrder || ''}
                      onChange={(e) => {
                        setSelectedOrder(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="input w-full"
                    >
                      <option value="">Velg fra liste...</option>
                      {orders.map((order) => (
                        <option key={order.ordrenr} value={order.ordrenr}>
                          #{order.ordrenr} - {order.kundenavn || order.kundenr} (
                          {new Date(order.dato).toLocaleDateString('nb-NO')})
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              )}
            </div>
            <div className="pt-6">
              <button type="button" onClick={handleCreate} className="btn-primary">
                + Ny Linje
              </button>
            </div>
          </div>
        </div>

        {linesQuery.isLoading && selectedOrder != null ? (
          <div className="card p-0 lg:p-0 overflow-hidden">
            <TableSkeleton rows={8} columns={10} />
          </div>
        ) : (
          <DataTable
            data={orderLines}
            columns={columns}
            emptyMessage="Ingen ordrelinjer funnet"
            paginate={false}
            disableClientSort
            enableCsvExport
            exportFilename="admin-orderlines"
            title="Ordrelinjer"
          />
        )}

        {paginationInfo && (
          <Pagination
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            variant="full"
            className="px-4 py-3 bg-dark-800/50 rounded-lg border border-dark-700"
          />
        )}

        <FormModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          title={editingLine ? 'Rediger Ordrelinje' : 'Ny Ordrelinje'}
          submitLabel={editingLine ? 'Lagre' : 'Opprett'}
        >
          <FormField label="Søk vare" htmlFor="orderlines-product-search">
            <input
              id="orderlines-product-search"
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="input"
              placeholder="Varekode eller navn..."
            />
          </FormField>
          <FormField label="Vare" htmlFor="orderlines-product">
            <select
              id="orderlines-product"
              value={formData.varekode}
              onChange={(e) => setFormData({ ...formData, varekode: e.target.value })}
              className="input"
              required
              disabled={productsQuery.isLoading}
            >
              <option value="">{productsQuery.isLoading ? 'Laster...' : 'Velg vare'}</option>
              {productOptions.map((product) => (
                <option key={product.varekode} value={product.varekode}>
                  {product.varekode} - {product.varenavn}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Antall" htmlFor="orderlines-antall">
              <input
                id="orderlines-antall"
                type="number"
                value={formData.antall}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    antall: parseBoundedInt(e.target.value, 1, 999999),
                  })
                }
                className="input"
                min="1"
                required
              />
            </FormField>
            <FormField label="Enhet" htmlFor="orderlines-enhet">
              <input
                id="orderlines-enhet"
                type="text"
                value={formData.enhet}
                onChange={(e) => setFormData({ ...formData, enhet: e.target.value })}
                className="input"
                required
              />
            </FormField>
          </div>
          <FormField label="Nettopris" htmlFor="orderlines-nettpris">
            <input
              id="orderlines-nettpris"
              type="number"
              value={formData.nettpris}
              onChange={(e) => {
                const value = Number(e.target.value);
                setFormData({
                  ...formData,
                  nettpris: Number.isFinite(value) ? value : 0,
                });
              }}
              className="input"
              step="0.01"
              required
            />
          </FormField>
        </FormModal>
      </div>
    </Layout>
  );
}
