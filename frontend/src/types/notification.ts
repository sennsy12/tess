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

export type OrderWorkflowStatus = 'new' | 'processing' | 'shipped' | 'invoiced' | 'cancelled';

export const ORDER_WORKFLOW_LABELS: Record<OrderWorkflowStatus, string> = {
  new: 'Ny',
  processing: 'Under behandling',
  shipped: 'Sendt',
  invoiced: 'Fakturert',
  cancelled: 'Kansellert',
};

export const ORDER_WORKFLOW_STYLES: Record<OrderWorkflowStatus, string> = {
  new: 'bg-blue-600/20 text-blue-300',
  processing: 'bg-amber-600/20 text-amber-300',
  shipped: 'bg-purple-600/20 text-purple-300',
  invoiced: 'bg-green-600/20 text-green-300',
  cancelled: 'bg-red-600/20 text-red-300',
};
