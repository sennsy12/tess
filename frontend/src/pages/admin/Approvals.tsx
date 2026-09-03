import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { Spinner } from '../../components/Spinner';
import { Pagination, TableSkeleton } from '../../components/admin';
import { OrderWorkflowBadge } from '../../components/orders/OrderWorkflowBadge';
import { ordersApi } from '../../lib/api';
import { formatCurrencyNok, formatDateNb } from '../../lib/formatters';
import { approvalsKeys, orderKeys } from '../../lib/queryKeys';
import {
  executeBulkStatusUpdate,
  partitionByLegalTransition,
  waitingAgeLabel,
  type BulkRunResult,
} from '../../lib/bulkTransitions';
import {
  ORDER_WORKFLOW_LABELS,
  getNextWorkflowStatuses,
  type OrderWorkflowStatus,
} from '../../types/notification';
import type { Order } from '../../types/order';

const PAGE_SIZE = 50;
const TAB_STATUSES: OrderWorkflowStatus[] = [
  'pending_approval',
  'new',
  'approved',
  'processing',
];
const DESTRUCTIVE_TARGETS = new Set<OrderWorkflowStatus>(['rejected', 'cancelled']);
const MODAL_SAMPLE_LIMIT = 5;

function StatusCount({ status }: { status: OrderWorkflowStatus }) {
  const { data } = useQuery({
    queryKey: approvalsKeys.count(status),
    queryFn: async () => {
      const response = await ordersApi.getAll({ workflowStatus: status, limit: 1 });
      return response.data?.pagination?.total ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return <>{typeof data === 'number' ? data : '…'}</>;
}

export function AdminApprovals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeStatus, setActiveStatus] = useState<OrderWorkflowStatus>('pending_approval');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<OrderWorkflowStatus | null>(null);
  const [bulkComment, setBulkComment] = useState('');
  const [bulkCommentError, setBulkCommentError] = useState('');
  const [runProgress, setRunProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastFailures, setLastFailures] = useState<BulkRunResult['failed']>([]);
  // Row cache for cross-page selections, kept in state so render-time reads
  // are legal and updates rerender. Populated inside selection handlers.
  const [selectedRowCache, setSelectedRowCache] = useState<ReadonlyMap<number, Order>>(
    () => new Map()
  );

  const rowsQuery = useQuery({
    queryKey: approvalsKeys.list(activeStatus, page),
    queryFn: async () => {
      const response = await ordersApi.getAll({ workflowStatus: activeStatus, page, limit: PAGE_SIZE });
      return response.data;
    },
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => rowsQuery.data?.data ?? [], [rowsQuery]);
  const pagination = rowsQuery.data?.pagination;

  const switchTab = (status: OrderWorkflowStatus) => {
    setActiveStatus(status);
    setPage(1);
    setSelectedIds(new Set());
    setSelectedRowCache(new Map());
    setBulkComment('');
    setBulkCommentError('');
  };

  const selectedRows = useMemo(
    () =>
      [...selectedIds]
        .map((id) => selectedRowCache.get(id))
        .filter((row): row is Order => Boolean(row)),
    [selectedIds, selectedRowCache],
  );

  const isAllPageSelected =
    rows.length > 0 && rows.every((order) => selectedIds.has(order.ordrenr));

  const toggleAllOnPage = () => {
    const selecting = !isAllPageSelected;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const order of rows) {
        if (selecting) next.add(order.ordrenr);
        else next.delete(order.ordrenr);
      }
      return next;
    });
    if (selecting) {
      setSelectedRowCache((previous) => {
        const next = new Map(previous);
        for (const order of rows) next.set(order.ordrenr, order);
        return next;
      });
    }
  };

  const toggleRow = (ordrenr: number) => {
    const order = rows.find((row) => row.ordrenr === ordrenr);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(ordrenr)) next.delete(ordrenr);
      else next.add(ordrenr);
      return next;
    });
    if (order && !selectedIds.has(ordrenr)) {
      setSelectedRowCache((previous) => new Map(previous).set(ordrenr, order));
    }
  };

  const actionTargets = useMemo(() => getNextWorkflowStatuses(activeStatus), [activeStatus]);
  const isBusy = runProgress !== null;

  /** Close the bulk-confirm modal and discard its comment draft + error. */
  const closeConfirmModal = () => {
    if (isBusy) return;
    setConfirmTarget(null);
    setBulkComment('');
    setBulkCommentError('');
  };

  const handleConfirmRun = () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    const comment = bulkComment.trim();
    if (target === 'rejected' && comment.length === 0) {
      setBulkCommentError('Begrunnelse er påkrevd ved avvisning');
      return;
    }
    setBulkCommentError('');
    const eligible = partitionByLegalTransition(selectedRows, target)
      .eligible.map((row) => row.ordrenr);
    setConfirmTarget(null);

    if (eligible.length === 0) {
      toast.error('Ingen av de valgte ordrene kan flyttes til denne statusen');
      return;
    }

    setLastFailures([]);
    let done = 0;
    setRunProgress({ done: 0, total: eligible.length });

    void executeBulkStatusUpdate(eligible, target, async (ordrenr, workflowStatus) => {
      try {
        await ordersApi.updateStatus(ordrenr, workflowStatus, comment || undefined);
      } finally {
        done += 1;
        setRunProgress({ done, total: eligible.length });
      }
    })
      .then(async (result) => {
        await queryClient.invalidateQueries({ queryKey: orderKeys.root() });
        await queryClient.invalidateQueries({ queryKey: approvalsKeys.root() });
        await queryClient.invalidateQueries({ queryKey: approvalsKeys.countRoot() });
        await queryClient.invalidateQueries({ queryKey: ['admin', 'order-history'] });
        await queryClient.invalidateQueries({ queryKey: ['kunde', 'order-history'] });

        setRunProgress(null);
        setBulkComment('');
        setBulkCommentError('');
        setSelectedIds((previous) => {
          const next = new Set(previous);
          for (const ordrenr of result.succeeded) {
            next.delete(ordrenr);
          }
          return next;
        });
        setSelectedRowCache((previous) => {
          const next = new Map(previous);
          for (const ordrenr of result.succeeded) {
            next.delete(ordrenr);
          }
          return next;
        });

        const label = ORDER_WORKFLOW_LABELS[target];
        if (result.succeeded.length > 0) {
          toast.success(`${result.succeeded.length} ordrer satt til «${label}»`);
        }
        if (result.failed.length > 0) {
          toast.error(`${result.failed.length} ordrer feilet`);
          setLastFailures(result.failed);
        }
      })
      .catch(() => {
        setRunProgress(null);
        toast.error('Masseoppdateringen feilet');
      });
  };

  const pendingModal = confirmTarget
    ? (() => {
        const { eligible, ineligible } = partitionByLegalTransition(selectedRows, confirmTarget);
        const sample = eligible.slice(0, MODAL_SAMPLE_LIMIT).map((row) => `#${row.ordrenr}`);
        const remaining = eligible.length - sample.length;
        const destructive = DESTRUCTIVE_TARGETS.has(confirmTarget);
        return { eligible, ineligible, sample, remaining, destructive };
      })()
    : null;

  return (
    <Layout title="Ordrekø">
      <Breadcrumb items={[{ label: 'Dashboard', to: '/admin' }, { label: 'Ordrekø' }]} />

      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <span className="label text-xs">Status</span>
              <div
                className="flex flex-wrap rounded-md border border-dark-700 overflow-hidden"
                role="group"
                aria-label="Velg ordrestatus"
              >
                {TAB_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={activeStatus === status}
                    disabled={isBusy}
                    onClick={() => switchTab(status)}
                    className={`px-3 py-2 text-sm transition-colors disabled:opacity-60 ${
                      activeStatus === status
                        ? 'bg-primary-600 text-white'
                        : 'bg-dark-900 text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                    }`}
                  >
                    {ORDER_WORKFLOW_LABELS[status]}
                    <span className="ml-1.5 opacity-80">
                      (<StatusCount status={status} />)
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {isBusy ? (
                <span className="flex items-center gap-2 text-sm text-dark-200 py-2">
                  <Spinner size="xs" />
                  Behandler {runProgress?.done ?? 0} / {runProgress?.total ?? 0}…
                </span>
              ) : (
                <>
                  <span className="text-sm text-dark-400 py-2">
                    {selectedIds.size > 0 ? `${selectedIds.size} valgt` : 'Ingen valgt'}
                  </span>
                  {actionTargets.map((target) => {
                    const destructive = DESTRUCTIVE_TARGETS.has(target);
                    return (
                      <button
                        key={target}
                        type="button"
                        disabled={selectedIds.size === 0}
                        onClick={() => setConfirmTarget(target)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          destructive
                            ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                            : 'btn-secondary'
                        }`}
                      >
                        {ORDER_WORKFLOW_LABELS[target]}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {lastFailures.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-red-300 font-medium">
                  {lastFailures.length} ordrer kunne ikke oppdateres:
                </p>
                <button
                  type="button"
                  onClick={() => setLastFailures([])}
                  className="p-1 rounded text-red-300 hover:bg-red-500/20"
                  aria-label="Lukk feilliste"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <ul className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                {lastFailures.map((failure) => (
                  <li key={failure.ordrenr} className="text-xs text-dark-300">
                    <span className="font-mono">#{failure.ordrenr}</span> — {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {rowsQuery.isLoading ? (
          <div className="card p-0 overflow-hidden">
            <TableSkeleton rows={8} columns={7} />
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="table-container border-0 rounded-none">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">
                <table className="w-full table-fixed">
                  <thead>
                    <tr>
                      <th className="table-header w-12">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={toggleAllOnPage}
                          disabled={isBusy || rows.length === 0}
                          aria-label="Velg alle rader på siden"
                          className="h-4 w-4 accent-primary-600"
                        />
                      </th>
                      <th className="table-header w-[11%]">Ordrenr</th>
                      <th className="table-header w-[11%]">Dato</th>
                      <th className="table-header">Kunde</th>
                      <th className="table-header w-[15%]">Firma</th>
                      <th className="table-header w-[13%] whitespace-nowrap text-right">Sum</th>
                      <th className="table-header w-[9%] whitespace-nowrap text-right">Ventet</th>
                      <th className="table-header w-[13%]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((order) => {
                      const age = waitingAgeLabel(order.dato);
                      const ageStyle =
                        age.level === 'danger'
                          ? 'bg-red-600/20 text-red-300'
                          : age.level === 'warn'
                            ? 'bg-yellow-600/20 text-yellow-300'
                            : 'bg-dark-800 text-dark-400';
                      return (
                        <tr
                          key={order.ordrenr}
                          className={`table-row ${!isBusy ? 'cursor-pointer' : ''}`}
                          onClick={() => !isBusy && navigate(`/admin/orders/${order.ordrenr}`)}
                        >
                          <td
                            className="table-cell"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(order.ordrenr)}
                              onChange={() => toggleRow(order.ordrenr)}
                              disabled={isBusy}
                              aria-label={`Velg ordre ${order.ordrenr}`}
                              className="h-4 w-4 accent-primary-600"
                            />
                          </td>
                          <td className="table-cell font-medium text-primary-400">
                            <Link
                              to={`/admin/orders/${order.ordrenr}`}
                              onClick={(event) => event.stopPropagation()}
                              className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
                            >
                              #{order.ordrenr}
                            </Link>
                          </td>
                          <td className="table-cell whitespace-nowrap text-dark-300">
                            {formatDateNb(order.dato)}
                          </td>
                          <td className="table-cell overflow-hidden text-ellipsis whitespace-nowrap">
                            <span title={`${order.kundenavn || order.kundenr}`}>
                              {order.kundenavn || order.kundenr}
                            </span>
                            {order.kunderef && (
                              <span className="ml-2 text-xs text-dark-500">{order.kunderef}</span>
                            )}
                          </td>
                          <td className="table-cell overflow-hidden text-ellipsis whitespace-nowrap text-dark-300">
                            <span className="block truncate" title={order.firmanavn}>
                              {order.firmanavn || '-'}
                            </span>
                          </td>
                          <td className="table-cell whitespace-nowrap text-right tabular-nums font-semibold">
                            {formatCurrencyNok(order.sum)}
                          </td>
                          <td className="table-cell whitespace-nowrap text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ageStyle}`}>
                              {age.label}
                            </span>
                          </td>
                          <td className="table-cell">
                            <OrderWorkflowBadge status={order.workflow_status} />
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="table-cell text-center text-dark-400 py-10">
                          Ingen ordrer i «{ORDER_WORKFLOW_LABELS[activeStatus]}»
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-dark-700/50 mt-0 p-4">
                <Pagination
                  pagination={{
                    page: pagination.page,
                    total: pagination.total,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                  }}
                  onPageChange={setPage}
                  variant="full"
                  itemLabel="ordrer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {confirmTarget && pendingModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => closeConfirmModal()}
          role="presentation"
        >
          <div
            className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-md shadow-2xl p-6 space-y-4"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={`text-lg font-semibold ${pendingModal.destructive ? 'text-red-400' : ''}`}>
              Sette {pendingModal.eligible.length} ordrer til «{ORDER_WORKFLOW_LABELS[confirmTarget]}»?
            </h3>

            {pendingModal.destructive && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                Obs: «{ORDER_WORKFLOW_LABELS[confirmTarget]}» er en endelig status — dette kan ikke
                angres fra Ordrekø.
              </p>
            )}

            {pendingModal.ineligible.length > 0 && (
              <p className="text-sm text-dark-400">
                {pendingModal.ineligible.length} av de valgte ordrene er endret siden du valgte dem
                og blir hoppet over.
              </p>
            )}

            <p className="text-sm text-dark-300 font-mono break-words">
              {pendingModal.sample.join(', ')}
              {pendingModal.remaining > 0 && ` +${pendingModal.remaining} flere`}
            </p>

            <div>
              <label className="label" htmlFor="bulkStatusComment">
                Kommentar til beslutningen{' '}
                {confirmTarget === 'rejected' ? (
                  <span className="text-red-300">(påkrevd ved avvisning)</span>
                ) : (
                  <span className="text-dark-500">(valgfritt — vises i ordrehistorikken)</span>
                )}
              </label>
              <textarea
                id="bulkStatusComment"
                className="input min-h-[4rem] w-full resize-y"
                maxLength={500}
                placeholder="F.eks. avvist pga. feil kvantum — kontakt selger for ny pris…"
                value={bulkComment}
                disabled={isBusy}
                onChange={(e) => {
                  setBulkComment(e.target.value);
                  if (bulkCommentError) setBulkCommentError('');
                }}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-dark-500">{bulkComment.trim().length}/500</span>
                {bulkCommentError && <span className="text-xs text-red-300">{bulkCommentError}</span>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={isBusy}
                onClick={() => closeConfirmModal()}
              >
                Avbryt
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pendingModal.destructive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
                disabled={isBusy || pendingModal.eligible.length === 0}
                onClick={handleConfirmRun}
              >
                Kjør nå
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
