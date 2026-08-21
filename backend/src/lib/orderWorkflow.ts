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

export function isOrderWorkflowStatus(value: string): value is OrderWorkflowStatus {
  return (ORDER_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

/** Statuses where the order is no longer active for customer-facing counts. */
export const ORDER_WORKFLOW_TERMINAL_STATUSES: readonly OrderWorkflowStatus[] = [
  'invoiced',
  'cancelled',
  'rejected',
];

/**
 * Statuses from which the owning kunde may cancel their own order.
 * Once admin processing has started (`processing`+), cancellation
 * requires admin intervention.
 */
export const KUNDE_CANCELLABLE_STATUSES: readonly OrderWorkflowStatus[] = [
  'pending_approval',
  'approved',
];

/**
 * SQL fragment for active-order filters. Values are compile-time constants (not user input).
 * Example: workflow_status NOT IN ('invoiced', 'cancelled', 'rejected')
 */
export const SQL_ACTIVE_ORDER_WHERE = `workflow_status NOT IN (${ORDER_WORKFLOW_TERMINAL_STATUSES.map((s) => `'${s}'`).join(', ')})`;

/** Allowed transitions from each workflow status. */
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
