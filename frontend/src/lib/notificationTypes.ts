import type { AppNotification } from '../types/notification';

/** Norwegian labels for known notification types (backend `notifications.type`). */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order_status: 'Ordrestatus',
  order_submitted: 'Nye ordrer',
  order_etl_refresh: 'Dataoppdatering',
  etl_completed: 'ETL fullført',
  etl_failed: 'ETL feilet',
};

/** Filter options for the notification center (`''` = all types). */
export const NOTIFICATION_TYPE_FILTERS: string[] = ['', ...Object.keys(NOTIFICATION_TYPE_LABELS)];

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? 'Annet';
}

/**
 * Returns incoming notifications the user has not seen yet.
 * Pure helper so the watcher logic stays unit-testable.
 */
export function detectNewNotifications(
  knownIds: ReadonlySet<number>,
  incoming: AppNotification[],
): AppNotification[] {
  return incoming.filter((n) => !knownIds.has(n.id));
}
