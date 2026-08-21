import type { OrderDetail } from '../types/order';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../types/notification';

interface OrderTimelineProps {
  order: OrderDetail;
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
  new: (order) => new Date(order.dato).toLocaleDateString('nb-NO'),
  pending_approval: (order) =>
    `Sendt ${new Date(order.status_updated_at || order.dato).toLocaleDateString('nb-NO')} – venter på godkjenning`,
  approved: () => 'Godkjent – klar for behandling',
  processing: (order) => `${order.lines.filter((l) => l.linjestatus === 1).length} av ${order.lines.length} aktive linjer`,
  shipped: (order) => order.lagernavn || 'Sendt fra lager',
  invoiced: (order) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: order.valutaid || 'NOK' }).format(order.sum),
};

/** Visual order progress from workflow status and line data. */
export function OrderTimeline({ order }: OrderTimelineProps) {
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

  return (
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
              {step.done ? '✓' : index + 1}
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
  );
}
