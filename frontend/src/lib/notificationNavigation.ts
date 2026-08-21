import type { AppNotification } from '../types/notification';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../lib/orderWorkflow';

export function getOrderPathFromNotification(
  notification: AppNotification,
  role: 'admin' | 'kunde' | 'analyse' | undefined,
): string | null {
  if (notification.type !== 'order_status') return null;

  const ordrenr = notification.metadata?.ordrenr;
  if (typeof ordrenr !== 'number' && typeof ordrenr !== 'string') return null;

  const id = String(ordrenr);
  if (role === 'kunde') return `/kunde/orders/${id}`;
  if (role === 'admin') return `/admin/orders/${id}`;
  return null;
}

/** Resolves a deep link path for a notification based on user role. */
export function buildDeepLink(
  notification: AppNotification,
  role: 'admin' | 'kunde' | 'analyse' | undefined,
): string | null {
  return getOrderPathFromNotification(notification, role);
}

export function formatNotificationTitle(notification: AppNotification): string {
  if (notification.title?.trim()) return notification.title;

  if (notification.type === 'order_status') {
    const ordrenr = notification.metadata?.ordrenr;
    const newStatus = notification.metadata?.newStatus as OrderWorkflowStatus | undefined;
    const statusLabel = newStatus ? ORDER_WORKFLOW_LABELS[newStatus] : 'oppdatert';
    if (ordrenr != null) {
      return `Ordre #${ordrenr} er ${statusLabel.toLowerCase()}`;
    }
    return `Ordrestatus ${statusLabel.toLowerCase()}`;
  }

  return 'Varsel';
}

export function isNotificationClickable(
  notification: AppNotification,
  role: 'admin' | 'kunde' | 'analyse' | undefined,
): boolean {
  return buildDeepLink(notification, role) !== null;
}
