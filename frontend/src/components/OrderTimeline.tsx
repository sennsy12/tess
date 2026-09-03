import { Check, MessageSquareText } from 'lucide-react';
import type { OrderDetail, OrderStatusHistoryEntry } from '../types/order';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../types/notification';
import { formatCurrency, formatDateNb } from '../lib/formatters';

interface OrderTimelineProps {
  order: OrderDetail;
  /** Workflow event feed (GET /orders/:ordrenr/history). Optional — legacy view when absent. */
  history?: OrderStatusHistoryEntry[];
  historyLoading?: boolean;
}

/** Legacy (imported) orders follow the linear fulfilment flow. */
const LEGACY_STEP_ORDER: OrderWorkflowStatus[] = ['new', 'processing', 'shipped', 'invoiced'];

/** Customer-placed orders pass through approval before fulfilment. */
const APPROVAL_STEP_ORDER: OrderWorkflowStatus[] = [
  'pending_approval',
  'approved',
  'processing',
  'shipped',
  'invoiced',
];

const STEP_DETAILS: Partial<Record<OrderWorkflowStatus, (order: OrderDetail) => string>> = {
  new: (order) => formatDateNb(order.dato),
  pending_approval: (order) =>
    `Sendt ${formatDateNb(order.status_updated_at || order.dato)} – venter på godkjenning`,
  approved: () => 'Godkjent – klar for behandling',
  processing: (order) => `${order.lines.filter((l) => l.linjestatus === 1).length} av ${order.lines.length} aktive linjer`,
  shipped: (order) => order.lagernavn || 'Sendt fra lager',
  invoiced: (order) => formatCurrency(order.sum, order.valutaid || 'NOK'),
};

function HistoryAvatar({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600/20 text-xs font-bold text-primary-300 ring-2 ring-primary-600/30"
      aria-hidden
    >
      {initial}
    </span>
  );
}

/** Visual order progress from workflow status and line data. */
export function OrderTimeline({ order, history, historyLoading }: OrderTimelineProps) {
  const workflow = (order.workflow_status ?? 'new') as OrderWorkflowStatus;

  const usesApprovalFlow = ['pending_approval', 'approved', 'rejected'].includes(workflow);
  const stepOrder = usesApprovalFlow ? APPROVAL_STEP_ORDER : LEGACY_STEP_ORDER;

  const isCancelled = workflow === 'cancelled';
  const isRejected = workflow === 'rejected';

  const workflowIndex = stepOrder.indexOf(workflow);
  const steps = stepOrder.map((status, index) => ({
    id: status,
    label: ORDER_WORKFLOW_LABELS[status],
    detail: STEP_DETAILS[status]?.(order) ?? '',
    done: isCancelled || isRejected ? false : workflowIndex >= index,
  }));

  if (isCancelled) {
    steps.push({
      id: 'cancelled',
      label: ORDER_WORKFLOW_LABELS.cancelled,
      detail: 'Ordren er kansellert',
      done: true,
    });
  }

  if (isRejected) {
    steps.push({
      id: 'rejected',
      label: ORDER_WORKFLOW_LABELS.rejected,
      detail: 'Ordren ble avvist – opprett gjerne en ny bestilling',
      done: true,
    });
  }

  const showHistorySection = historyLoading || (history !== undefined && history.length > 0);

  return (
    <div className="space-y-6">
      <ol className="space-y-0" aria-label="Ordrestatus">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? 'bg-green-600/30 text-green-300 ring-2 ring-green-600/50'
                    : 'bg-dark-800 text-dark-500 ring-2 ring-dark-700'
                }`}
                aria-hidden
              >
                {step.done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span className={`w-0.5 flex-1 min-h-[2rem] ${step.done ? 'bg-green-700/50' : 'bg-dark-700'}`} />
              )}
            </div>
            <div className="pb-6 min-w-0">
              <p className={`font-medium ${step.done ? 'text-dark-100' : 'text-dark-400'}`}>{step.label}</p>
              <p className="text-sm text-dark-400 mt-0.5">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      {showHistorySection && (
        <section aria-label="Hendelseslogg">
          <h4 className="text-sm font-semibold text-dark-200 mb-3">Hendelser</h4>
          {historyLoading && (
            <div className="space-y-2" aria-label="Laster hendelser">
              {[0, 1].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-dark-800/60" />
              ))}
            </div>
          )}
          {!historyLoading && history && history.length > 0 && (
            <ol className="space-y-3">
              {history.map((entry) => {
                const from = entry.previous_status ? ORDER_WORKFLOW_LABELS[entry.previous_status] : null;
                const to = ORDER_WORKFLOW_LABELS[entry.new_status];
                const bad = entry.new_status === 'rejected' || entry.new_status === 'cancelled';
                return (
                  <li key={entry.id} className="flex gap-3">
                    <HistoryAvatar name={entry.changed_by_username} />
                    <div className="min-w-0 flex-1 rounded-lg border border-dark-700/60 bg-dark-800/40 px-3 py-2">
                      <p className="text-sm text-dark-100">
                        {from ? `${from} → ` : ''}
                        <span className={bad ? 'font-semibold text-red-300' : 'font-semibold text-green-300'}>
                          {to}
                        </span>{' '}
                        <span className="text-dark-400">
                          av {entry.changed_by_username} ·{' '}
                          {formatDateNb(entry.created_at, {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                      {entry.comment && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-dark-200">
                          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dark-400" aria-hidden />
                          <span className="break-words">{entry.comment}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
