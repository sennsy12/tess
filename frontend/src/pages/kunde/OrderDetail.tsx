import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { Repeat, XCircle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { OrderTimeline } from '../../components/OrderTimeline';
import { OrderWorkflowBadge } from '../../components/orders/OrderWorkflowBadge';
import { OrderLineSummaryCard } from '../../components/orders/OrderLineSummaryCard';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { ordersApi } from '../../lib/api';
import { downloadOrderCsv } from '../../lib/orderExport';
import { getApiError } from '../../lib/apiErrors';
import { addOrderToCart } from '../../lib/reorder';
import { downloadOrderPdf } from '../../lib/orderPdf';
import { useCart } from '../../context/useCart';
import { KUNDE_CANCELLABLE_STATUSES, type OrderWorkflowStatus } from '../../types/notification';
import type { OrderDetail } from '../../types/order';

export function KundeOrderDetail() {
  const { ordrenr } = useParams<{ ordrenr: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();
  const orderId = ordrenr ? parseInt(ordrenr, 10) : NaN;
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [isPdfBusy, setIsPdfBusy] = useState(false);

  const { data: order, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['kunde', 'order', orderId],
    queryFn: async () => {
      const response = await ordersApi.getOne(orderId);
      return response.data as OrderDetail;
    },
    enabled: Number.isFinite(orderId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(orderId),
    onSuccess: () => {
      setConfirmCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['kunde'] });
      toast.success('Ordren er kansellert');
    },
    onError: (err) => {
      setConfirmCancelOpen(false);
      toast.error(getApiError(err, 'Kunne ikke kansellere ordren'));
    },
  });

  const cancellable =
    order != null &&
    KUNDE_CANCELLABLE_STATUSES.includes((order.workflow_status ?? 'new') as OrderWorkflowStatus);

  const handleDownloadPdf = async () => {
    if (!order || isPdfBusy) return;
    setIsPdfBusy(true);
    try {
      await downloadOrderPdf(order);
    } catch {
      toast.error('Kunne ikke generere PDF');
    } finally {
      setIsPdfBusy(false);
    }
  };

  const handleReorder = () => {
    if (!order) return;
    const result = addOrderToCart(order, cart.addItem);
    if (result.added === 0) {
      toast.error('Ingen gyldige varer å bestille igjen');
      return;
    }
    const skippedNote = result.skipped > 0 ? ` (${result.skipped} ugyldige linjer hoppet over)` : '';
    toast.success(`${result.added} varer lagt i handlekurven${skippedNote}`);
    navigate('/kunde/order/new');
  };

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
          <button
            type="button"
            onClick={handleReorder}
            className="btn-primary flex items-center gap-2"
          >
            <Repeat className="h-4 w-4" aria-hidden />
            Bestill igjen
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            className="btn-secondary"
            disabled={isPdfBusy}
          >
            {isPdfBusy ? 'Genererer…' : 'Last ned PDF'}
          </button>
          <button type="button" onClick={() => downloadOrderCsv(order)} className="btn-secondary">
            Last ned CSV
          </button>
          {cancellable && (
            <button
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
              className="btn-secondary hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2"
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4" aria-hidden />
              Kanseller ordre
            </button>
          )}
        </div>

        {/* Cancel confirmation */}
        <AnimatePresence>
          {confirmCancelOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => !cancelMutation.isPending && setConfirmCancelOpen(false)}
                role="presentation"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative card w-full max-w-md z-10"
                role="dialog"
                aria-modal="true"
                aria-label="Bekreft kansellering"
              >
                <h3 className="text-lg font-semibold mb-2">Kansellere ordre #{order.ordrenr}?</h3>
                <p className="text-sm text-dark-400 mb-5">
                  Ordren fjernes fra godkjenningskøen. Denne handlingen kan ikke angres.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={cancelMutation.isPending}
                    onClick={() => setConfirmCancelOpen(false)}
                  >
                    Behold ordre
                  </button>
                  <button
                    type="button"
                    className="btn-primary bg-red-600 border-red-600 hover:bg-red-500 flex items-center gap-2"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate()}
                  >
                    {cancelMutation.isPending ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                    ) : (
                      <XCircle className="h-4 w-4" aria-hidden />
                    )}
                    Kanseller
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
          {order.lineSummary && <OrderLineSummaryCard summary={order.lineSummary} />}
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