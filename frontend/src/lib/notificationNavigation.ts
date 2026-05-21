import type { AppNotification } from '../types/notification';

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

export function isNotificationClickable(
  notification: AppNotification,
  role: 'admin' | 'kunde' | 'analyse' | undefined,
): boolean {
  return getOrderPathFromNotification(notification, role) !== null;
}
