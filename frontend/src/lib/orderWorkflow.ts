export const ORDER_WORKFLOW_STATUSES = [
  'new',
  'pending_approval',
  'approved',
  'rejected',
  'processing',
  'shipped',
  'invoiced',
  'cancelled',
] as const;

export type OrderWorkflowStatus = (typeof ORDER_WORKFLOW_STATUSES)[number];

export const ORDER_WORKFLOW_LABELS: Record<OrderWorkflowStatus, string> = {
  new: 'Ny',
  pending_approval: 'Til godkjenning',
  approved: 'Godkjent',
  rejected: 'Avvist',
  processing: 'Under behandling',
  shipped: 'Sendt',
  invoiced: 'Fakturert',
  cancelled: 'Kansellert',
};

export const ORDER_WORKFLOW_STYLES: Record<OrderWorkflowStatus, string> = {
  new: 'bg-blue-600/20 text-blue-300',
  pending_approval: 'bg-yellow-600/20 text-yellow-300',
  approved: 'bg-teal-600/20 text-teal-300',
  rejected: 'bg-rose-700/20 text-rose-300',
  processing: 'bg-amber-600/20 text-amber-300',
  shipped: 'bg-purple-600/20 text-purple-300',
  invoiced: 'bg-green-600/20 text-green-300',
  cancelled: 'bg-red-600/20 text-red-300',
};

/** Statuses from which the owning kunde may cancel their own order. */
export const KUNDE_CANCELLABLE_STATUSES: readonly OrderWorkflowStatus[] = [
  'pending_approval',
  'approved',
];

export const ORDER_WORKFLOW_TRANSITIONS: Record<
  OrderWorkflowStatus,
  readonly OrderWorkflowStatus[]
> = {
  new: ['processing', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'cancelled'],
  rejected: [],
  processing: ['shipped', 'cancelled'],
  shipped: ['invoiced', 'cancelled'],
  invoiced: [],
  cancelled: [],
};

export function isOrderWorkflowStatus(value: string): value is OrderWorkflowStatus {
  return (ORDER_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

export function getNextWorkflowStatuses(from: OrderWorkflowStatus): OrderWorkflowStatus[] {
  return [...ORDER_WORKFLOW_TRANSITIONS[from]];
}

export function canTransition(
  from: OrderWorkflowStatus,
  to: OrderWorkflowStatus,
): boolean {
  if (from === to) return true;
  return ORDER_WORKFLOW_TRANSITIONS[from].includes(to);
}
