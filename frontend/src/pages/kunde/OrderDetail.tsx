import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { OrderTimeline } from '../../components/OrderTimeline';
import { OrderWorkflowBadge } from '../../components/orders/OrderWorkflowBadge';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { ordersApi } from '../../lib/api';
import { downloadOrderCsv } from '../../lib/orderExport';
import type { OrderDetail } from '../../types/order';

export function KundeOrderDetail() {
  const { ordrenr } = useParams<{ ordrenr: string }>();
  const navigate = useNavigate();
  const orderId = ordrenr ? parseInt(ordrenr, 10) : NaN;

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kunde', 'order', orderId],
    queryFn: async () => {
      const response = await ordersApi.getOne(orderId);
      return response.data as OrderDetail;
    },
    enabled: Number.isFinite(orderId),
  });

  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste ordre';

  if (isLoading) {
    return (
      <Layout title="Ordre detaljer">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        </div>
      </Layout>
    );
  }

  if (isError || !order) {
    return (
      <Layout title="Ordre detaljer">
        <div className="space-y-4">
          <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />
          <button type="button" onClick={() => navigate('/kunde/orders')} className="btn-secondary">
            ← Tilbake til ordrer
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Ordre #${order.ordrenr}`}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Hjem', to: '/kunde' },
            { label: 'Ordrer', to: '/kunde/orders' },
            { label: `#${order.ordrenr}` },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/kunde/orders')} className="btn-secondary">
            ← Tilbake til ordrer
          </button>
          <button type="button" onClick={() => downloadOrderCsv(order)} className="btn-primary">
            Last ned CSV
          </button>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Ordrestatus</h3>
            <OrderWorkflowBadge status={order.workflow_status} />
          </div>
          <OrderTimeline order={order} />
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-sm text-dark-400">Ordrenummer</span>
              <p className="text-xl font-bold text-primary-400">#{order.ordrenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Dato</span>
              <p className="text-lg font-medium">{new Date(order.dato).toLocaleDateString('nb-NO')}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Kunde</span>
              <p className="text-lg font-medium">{order.kundenavn || order.kundenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Total sum</span>
              <p className="text-xl font-bold text-green-400">
                {new Intl.NumberFormat('nb-NO', {
                  style: 'currency',
                  currency: order.valutaid || 'NOK',
                }).format(order.sum)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-dark-800">
            <div>
              <span className="text-sm text-dark-400">Firma</span>
              <p>{order.firmanavn || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Lager</span>
              <p>{order.lagernavn || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Kundeordrereferanse</span>
              <p>{order.kundeordreref || '-'}</p>
            </div>
          </div>
        </div>

        {/* Mobile line cards */}
        <div className="space-y-3 lg:hidden">
          <h3 className="text-lg font-semibold">Ordrelinjer ({order.lines.length})</h3>
          {order.lines.map((line) => (
            <div key={line.linjenr} className="card text-sm">
              <div className="flex justify-between font-medium">
                <span>
                  #{line.linjenr} {line.varenavn || line.varekode}
                </span>
                <span>
                  {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(
                    line.linjesum,
                  )}
                </span>
              </div>
              <p className="text-dark-400 mt-1">
                {line.antall} {line.enhet} · {line.varegruppe || '-'}
              </p>
            </div>
          ))}
        </div>

        <div className="card hidden lg:block">
          <h3 className="text-lg font-semibold mb-4">Ordrelinjer ({order.lines.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Linje</th>
                  <th className="table-header">Varekode</th>
                  <th className="table-header">Varenavn</th>
                  <th className="table-header">Varegruppe</th>
                  <th className="table-header text-right">Antall</th>
                  <th className="table-header">Enhet</th>
                  <th className="table-header text-right">Pris</th>
                  <th className="table-header text-right">Sum</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.linjenr} className="hover:bg-dark-800/30">
                    <td className="table-cell text-dark-400">{line.linjenr}</td>
                    <td className="table-cell font-mono text-sm">{line.varekode}</td>
                    <td className="table-cell font-medium">{line.varenavn || '-'}</td>
                    <td className="table-cell">
                      <span className="px-2 py-1 bg-primary-600/20 text-primary-300 rounded text-xs">
                        {line.varegruppe || '-'}
                      </span>
                    </td>
                    <td className="table-cell text-right">{line.antall}</td>
                    <td className="table-cell">{line.enhet}</td>
                    <td className="table-cell text-right">
                      {new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(
                        line.nettpris,
                      )}
                    </td>
                    <td className="table-cell text-right font-semibold">
                      {new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2 }).format(
                        line.linjesum,
                      )}
                    </td>
                    <td className="table-cell">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          line.linjestatus === 1
                            ? 'bg-green-600/20 text-green-300'
                            : 'bg-dark-600/40 text-dark-300'
                        }`}
                      >
                        {line.linjestatus === 1 ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}