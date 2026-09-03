import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Repeat } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { OrderTimeline } from '../../components/OrderTimeline';
import { OrderWorkflowBadge } from '../../components/orders/OrderWorkflowBadge';
import { ordersApi } from '../../lib/api';
import { getApiError } from '../../lib/apiErrors';
import { addOrderToCart } from '../../lib/reorder';
import { downloadOrderPdf } from '../../lib/orderPdf';
import { useCart } from '../../context/useCart';
import {
  ORDER_WORKFLOW_LABELS,
  ORDER_WORKFLOW_STATUSES,
  canTransition,
  getNextWorkflowStatuses,
  type OrderWorkflowStatus,
} from '../../types/notification';
import { OrderLineSummaryCard } from '../../components/orders/OrderLineSummaryCard';
import { Spinner } from '../../components/Spinner';
import { formatCurrency, formatDateNb, formatDecimalNb } from '../../lib/formatters';

import { OrderDetail, type OrderStatusHistoryEntry } from '../../types/order';

export function AdminOrderDetail() {
  const { ordrenr } = useParams<{ ordrenr: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusComment, setStatusComment] = useState('');
  const [pendingStatus, setPendingStatus] = useState<OrderWorkflowStatus | ''>('');

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

  const loadOrder = async (id: number) => {
    // Reset unsaved decision draft — the component instance is reused when
    // navigating order A → B, so a stale selection/comment must not leak
    // into the newly opened order.
    setPendingStatus('');
    setStatusComment('');
    try {
      const response = await ordersApi.getOne(id);
      setOrder(response.data);
      // Timeline is auxiliary — a missing history table/endpoint must not
      // break the order view (e.g. DBs that haven't migrated yet).
      setHistoryLoading(true);
      try {
        const historyResponse = await ordersApi.getHistory(id);
        setHistory(historyResponse.data?.data ?? []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    } catch (err: unknown) {
      setError(getApiError(err, 'Kunne ikke laste ordre'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ordrenr) {
      void loadOrder(parseInt(ordrenr));
    }
  }, [ordrenr]);

  const handleStatusChange = async (workflowStatus: OrderWorkflowStatus) => {
    if (!order) return;
    const current = (order.workflow_status ?? 'new') as OrderWorkflowStatus;
    if (!canTransition(current, workflowStatus)) {
      toast.error('Ugyldig statusovergang');
      return;
    }
    const comment = statusComment.trim();
    if (workflowStatus === 'rejected' && comment.length === 0) {
      toast.error('Begrunnelse er påkrevd ved avvisning');
      return;
    }
    setStatusSaving(true);
    try {
      await ordersApi.updateStatus(order.ordrenr, workflowStatus, comment || undefined);
      setOrder({ ...order, workflow_status: workflowStatus });
      setStatusComment('');
      setPendingStatus('');
      try {
        const historyResponse = await ordersApi.getHistory(order.ordrenr);
        setHistory(historyResponse.data?.data ?? []);
      } catch {
        // Keep the updated status even if history refresh fails.
      }
      toast.success('Ordrestatus oppdatert');
    } catch (err: unknown) {
      toast.error(getApiError(err, 'Kunne ikke oppdatere status'));
    } finally {
      setStatusSaving(false);
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

  if (isLoading) {
    return (
      <Layout title="Ordre detaljer">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" className="text-primary-500" label="Laster ordre…" />
        </div>
      </Layout>
    );
  }

  if (error || !order) {
    return (
      <Layout title="Ordre detaljer">
        <div className="space-y-4">
          <Breadcrumb
            items={[
              { label: 'Dashboard', to: '/admin' },
              { label: 'Ordrer', to: '/admin/orders' },
              { label: 'Detaljer' },
            ]}
          />
          <QueryErrorBanner message={error || 'Ordre ikke funnet'} onRetry={() => ordrenr && loadOrder(parseInt(ordrenr, 10))} />
          <button type="button" onClick={() => navigate('/admin/orders')} className="btn-secondary">
            ← Tilbake til ordrer
          </button>
        </div>
      </Layout>
    );
  }

  const currentStatus = (order.workflow_status ?? 'new') as OrderWorkflowStatus;
  const allowedStatuses = [currentStatus, ...getNextWorkflowStatuses(currentStatus)];

  return (
    <Layout title={`Ordre #${order.ordrenr}`}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', to: '/admin' },
            { label: 'Ordrer', to: '/admin/orders' },
            { label: `#${order.ordrenr}` },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/admin/orders')} className="btn-secondary">
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
        </div>

        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <span className="text-sm text-dark-400">Ordrenummer</span>
              <p className="text-xl font-bold text-primary-400">#{order.ordrenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Dato</span>
              <p className="text-lg font-medium">{formatDateNb(order.dato)}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Kunde</span>
              <p className="text-lg font-medium">{order.kundenavn || order.kundenr}</p>
            </div>
            <div>
              <span className="text-sm text-dark-400">Total sum</span>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(order.sum, order.valutaid || 'NOK')}
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

          <div className="mt-6 pt-6 border-t border-dark-800 flex flex-wrap items-end gap-4">
            <div>
              <span className="text-sm text-dark-400 block mb-2">Arbeidsflytstatus</span>
              <OrderWorkflowBadge status={order.workflow_status} />
            </div>
            <div>
              <label className="label" htmlFor="workflowStatusSelect">
                Endre status
              </label>
              <select
                id="workflowStatusSelect"
                className="input min-w-[200px]"
                value={pendingStatus || order.workflow_status}
                disabled={statusSaving}
                onChange={(e) => setPendingStatus(e.target.value as OrderWorkflowStatus)}
              >
                {(ORDER_WORKFLOW_STATUSES.filter((value) => allowedStatuses.includes(value))).map(
                  (value) => (
                    <option key={value} value={value}>
                      {ORDER_WORKFLOW_LABELS[value]}
                    </option>
                  ),
                )}
              </select>
            </div>
            {(pendingStatus && pendingStatus !== currentStatus) && (
              <button
                type="button"
                className="btn-primary"
                disabled={statusSaving}
                onClick={() => void handleStatusChange(pendingStatus as OrderWorkflowStatus)}
              >
                {statusSaving ? 'Lagrer…' : 'Lagre status'}
              </button>
            )}
          </div>
          {(pendingStatus && pendingStatus !== currentStatus) && (
            <div className="mt-4 max-w-xl">
              <label className="label" htmlFor="workflowComment">
                Kommentar til beslutningen{' '}
                {pendingStatus === 'rejected' ? (
                  <span className="text-red-300">(påkrevd ved avvisning)</span>
                ) : (
                  <span className="text-dark-500">(valgfritt)</span>
                )}
              </label>
              <textarea
                id="workflowComment"
                className="input min-h-[4.5rem] w-full resize-y"
                maxLength={500}
                placeholder={
                  pendingStatus === 'rejected'
                    ? 'F.eks. feil pris, manglende referanse, kontakt selger…'
                    : 'F.eks. godkjent etter avtale på e-post…'
                }
                value={statusComment}
                disabled={statusSaving}
                onChange={(e) => setStatusComment(e.target.value)}
              />
              <p className="mt-1 text-xs text-dark-500">{statusComment.trim().length}/500</p>
            </div>
          )}
          {order.lineSummary && <OrderLineSummaryCard summary={order.lineSummary} />}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Status og hendelser</h3>
          <OrderTimeline order={order} history={history} historyLoading={historyLoading} />
        </div>

        {/* Order lines */}
        <div className="card">
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
                  <th className="table-header">Henvisninger</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => {
                  const refs = [line.henvisning1, line.henvisning2, line.henvisning3, line.henvisning4, line.henvisning5].filter(Boolean);
                  return (
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
                        {formatDecimalNb(line.nettpris)}
                      </td>
                      <td className="table-cell text-right font-semibold">
                        {formatDecimalNb(line.linjesum)}
                      </td>
                      <td className="table-cell">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${line.linjestatus === 1 ? 'bg-green-600/20 text-green-300' : 'bg-dark-600/40 text-dark-300'}`}>
                          {line.linjestatus === 1 ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="table-cell">
                        {refs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {refs.map((ref, i) => (
                              <span key={i} className="inline-block px-2 py-0.5 bg-dark-700 rounded text-xs">
                                {ref}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-dark-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-dark-800/50">
                  <td colSpan={9} className="table-cell text-right font-semibold">
                    Totalt:
                  </td>
                  <td className="table-cell text-right font-bold text-lg text-green-400">
                    {formatCurrency(order.sum, order.valutaid || 'NOK')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* References */}
        {order.lines.some(l => l.henvisning1 || l.henvisning2 || l.henvisning3) && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Henvisninger</h3>
            <div className="space-y-2">
              {order.lines.filter(l => l.henvisning1 || l.henvisning2).map((line) => (
                <div key={line.linjenr} className="p-3 bg-dark-800/50 rounded-lg">
                  <span className="text-dark-400 text-sm">Linje {line.linjenr}: </span>
                  {[line.henvisning1, line.henvisning2, line.henvisning3, line.henvisning4, line.henvisning5]
                    .filter(Boolean)
                    .map((ref: string | undefined, i: number) => (
                      <span key={i} className="inline-block px-2 py-1 bg-dark-700 rounded text-sm mr-2">
                        {ref}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
