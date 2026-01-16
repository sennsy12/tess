import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { DataTable } from '../../components/DataTable';
import { ordersApi, orderlinesApi, productsApi } from '../../lib/api';

interface OrderLine {
  linjenr: number;
  ordrenr: number;
  varekode: string;
  varenavn?: string;
  antall: number;
  enhet: string;
  nettpris: number;
  linjesum: number;
  linjestatus: number;
}

export function AdminOrderLines() {
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLine, setEditingLine] = useState<OrderLine | null>(null);
  const [formData, setFormData] = useState({
    varekode: '',
    antall: 1,
    enhet: 'stk',
    nettpris: 0,
    linjestatus: 1,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      loadOrderLines(selectedOrder);
    }
  }, [selectedOrder]);

  const loadInitialData = async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        ordersApi.getAll({ limit: 100 }), // Fetch recent 100 orders for dropdown
        productsApi.getAll(),
      ]);
      
      const ordersData = ordersRes.data.data || ordersRes.data;
      setOrders(ordersData);
      setProducts(productsRes.data);
      if (ordersData.length > 0) {
        setSelectedOrder(ordersData[0].ordrenr);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderLines = async (ordrenr: number) => {
    try {
      const response = await orderlinesApi.getByOrder(ordrenr);
      setOrderLines(response.data);
    } catch (error) {
      console.error('Failed to load order lines:', error);
    }
  };

  const handleCreate = () => {
    setEditingLine(null);
    setFormData({ varekode: products[0]?.varekode || '', antall: 1, enhet: 'stk', nettpris: 0, linjestatus: 1 });
    setShowModal(true);
  };

  const handleEdit = (line: OrderLine) => {
    setEditingLine(line);
    setFormData({
      varekode: line.varekode,
      antall: line.antall,
      enhet: line.enhet,
      nettpris: line.nettpris,
      linjestatus: line.linjestatus,
    });
    setShowModal(true);
  };

  const handleDelete = async (line: OrderLine) => {
    if (!confirm('Er du sikker på at du vil slette denne linjen?')) return;
    
    try {
      await orderlinesApi.delete(line.ordrenr, line.linjenr);
      loadOrderLines(selectedOrder!);
    } catch (error) {
      console.error('Failed to delete order line:', error);
      alert('Kunne ikke slette ordrelinje');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLine) {
        await orderlinesApi.update(editingLine.ordrenr, editingLine.linjenr, formData);
      } else {
        await orderlinesApi.create({ ordrenr: selectedOrder, ...formData });
      }
      setShowModal(false);
      loadOrderLines(selectedOrder!);
    } catch (error) {
      console.error('Failed to save order line:', error);
      alert('Kunne ikke lagre ordrelinje');
    }
  };

  const columns = [
    { key: 'linjenr', header: 'Linje' },
    { key: 'varekode', header: 'Varekode' },
    { key: 'varenavn', header: 'Varenavn' },
    { key: 'antall', header: 'Antall' },
    { key: 'enhet', header: 'Enhet' },
    {
      key: 'nettpris',
      header: 'Pris',
      render: (value: number) => new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(value),
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
      key: 'actions',
      header: 'Handlinger',
      sortable: false,
      render: (_: any, row: OrderLine) => (
        <div className="flex gap-2">
          <button onClick={() => handleEdit(row)} className="text-primary-400 hover:text-primary-300">
            ✏️
          </button>
          <button onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-300">
            🗑️
          </button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Layout title="Ordrelinjer">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ordrelinjer">
      <div className="space-y-6">
        {/* Order selector */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="label">Søk/Velg Ordre</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={selectedOrder || ''}
                  onChange={(e) => setSelectedOrder(Number(e.target.value))}
                  className="input w-32"
                  placeholder="Ordrenr"
                />
                <select
                  value={selectedOrder || ''}
                  onChange={(e) => setSelectedOrder(Number(e.target.value))}
                  className="input flex-1"
                >
                  <option value="">Velg fra liste...</option>
                  {orders.map((order) => (
                    <option key={order.ordrenr} value={order.ordrenr}>
                      #{order.ordrenr} - {order.kundenavn || order.kundenr} ({new Date(order.dato).toLocaleDateString('nb-NO')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pt-6">
              <button onClick={handleCreate} className="btn-primary">
                ➕ Ny Linje
              </button>
            </div>
          </div>
        </div>

        {/* Order lines table */}
        <DataTable
          data={orderLines}
          columns={columns}
          emptyMessage="Ingen ordrelinjer funnet"
        />

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="card max-w-md w-full m-4">
              <h3 className="text-lg font-semibold mb-4">
                {editingLine ? 'Rediger Ordrelinje' : 'Ny Ordrelinje'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Vare</label>
                  <select
                    value={formData.varekode}
                    onChange={(e) => setFormData({ ...formData, varekode: e.target.value })}
                    className="input"
                    required
                  >
                    {products.map((product) => (
                      <option key={product.varekode} value={product.varekode}>
                        {product.varekode} - {product.varenavn}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Antall</label>
                    <input
                      type="number"
                      value={formData.antall}
                      onChange={(e) => setFormData({ ...formData, antall: Number(e.target.value) })}
                      className="input"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Enhet</label>
                    <input
                      type="text"
                      value={formData.enhet}
                      onChange={(e) => setFormData({ ...formData, enhet: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Nettopris</label>
                  <input
                    type="number"
                    value={formData.nettpris}
                    onChange={(e) => setFormData({ ...formData, nettpris: Number(e.target.value) })}
                    className="input"
                    step="0.01"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="btn-primary flex-1">
                    {editingLine ? 'Lagre' : 'Opprett'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                    Avbryt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
