import type { OrderDetail } from '../types/order';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../types/notification';

interface OrderTimelineProps {
  order: OrderDetail;
}

const WORKFLOW_STEP_ORDER: OrderWorkflowStatus[] = [
  'new',
  'processing',
  'shipped',
  'invoiced',
];

/** Visual order progress from workflow status and line data. */
export function OrderTimeline({ order }: OrderTimelineProps) {
  const workflow = (order.workflow_status ?? 'new') as OrderWorkflowStatus;
  const workflowIndex = WORKFLOW_STEP_ORDER.indexOf(workflow);
  const isCancelled = workflow === 'cancelled';

  const activeLines = order.lines.filter((l) => l.linjestatus === 1).length;
  const totalLines = order.lines.length;

  const steps = WORKFLOW_STEP_ORDER.map((status, index) => ({
    id: status,
    label: ORDER_WORKFLOW_LABELS[status],
    detail:
      status === 'new'
        ? new Date(order.dato).toLocaleDateString('nb-NO')
        : status === 'processing'
          ? `${activeLines} av ${totalLines} aktive linjer`
          : status === 'shipped'
            ? order.lagernavn || 'Sendt fra lager'
            : new Intl.NumberFormat('nb-NO', {
                style: 'currency',
                currency: order.valutaid || 'NOK',
              }).format(order.sum),
    done: isCancelled ? false : workflowIndex >= index,
  }));

  if (isCancelled) {
    steps.push({
      id: 'cancelled',
      label: ORDER_WORKFLOW_LABELS.cancelled,
      detail: 'Ordren er kansellert',
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
