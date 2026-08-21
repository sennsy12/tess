export type NotificationAudience = 'admin' | 'kunde';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  audience: NotificationAudience;
  kundenr: string | null;
  created_at: string;
  read_at?: string | null;
}

export {
  type OrderWorkflowStatus,
  ORDER_WORKFLOW_LABELS,
  ORDER_WORKFLOW_STYLES,
  ORDER_WORKFLOW_STATUSES,
  KUNDE_CANCELLABLE_STATUSES,
  canTransition,
  getNextWorkflowStatuses,
  isOrderWorkflowStatus,
} from '../lib/orderWorkflow';
