export const ORDER_WORKFLOW_STATUSES = [
  'new',
  'processing',
  'shipped',
  'invoiced',
  'cancelled',
] as const;

export type OrderWorkflowStatus = (typeof ORDER_WORKFLOW_STATUSES)[number];

export const ORDER_WORKFLOW_LABELS: Record<OrderWorkflowStatus, string> = {
  new: 'Ny',
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
];

/**
 * SQL fragment for active-order filters. Values are compile-time constants (not user input).
 * Example: workflow_status NOT IN ('invoiced', 'cancelled')
 */
export const SQL_ACTIVE_ORDER_WHERE = `workflow_status NOT IN (${ORDER_WORKFLOW_TERMINAL_STATUSES.map((s) => `'${s}'`).join(', ')})`;
