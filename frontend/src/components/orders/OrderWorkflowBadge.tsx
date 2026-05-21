import type { OrderWorkflowStatus } from '../../types/notification';
import { ORDER_WORKFLOW_LABELS, ORDER_WORKFLOW_STYLES } from '../../types/notification';

interface OrderWorkflowBadgeProps {
  status?: OrderWorkflowStatus | string | null;
  className?: string;
}

export function OrderWorkflowBadge({ status, className = '' }: OrderWorkflowBadgeProps) {
  const value = (status ?? 'new') as OrderWorkflowStatus;
  const label = ORDER_WORKFLOW_LABELS[value] ?? value;
  const style = ORDER_WORKFLOW_STYLES[value] ?? 'bg-dark-600/40 text-dark-300';

  return (
    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
