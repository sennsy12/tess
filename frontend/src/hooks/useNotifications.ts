import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../lib/api/notifications';

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: () => notificationsApi.list({ limit, page: 1 }).then((res) => res.data.data ?? []),
    refetchInterval: 30_000,
    // Polling a hidden tab burns battery/data for zero visible benefit.
    refetchIntervalInBackground: false,
  });
}

export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, 'unread-count'],
    queryFn: () => notificationsApi.unreadCount().then((res) => res.data.count),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    enabled: options?.enabled,
  });
}

/**
 * Exact unread badge count without an extra request in the common case.
 *
 * Reuses the already-polled `useNotifications(limit)` cache: when the list
 * is shorter than the limit it cannot be truncated, so the unread count
 * derived from it is exact and the dedicated count endpoint is skipped
 * entirely. Only when the list is full (possible truncation) does the
 * server count query fire. Mark-read mutations invalidate the shared key,
 * so both sources stay consistent.
 */
export function useUnreadBadgeCount(limit = 15): number {
  const { data: notifications = [] } = useNotifications(limit);
  const truncated = notifications.length >= limit;
  const { data: serverCount = 0 } = useUnreadNotificationCount({ enabled: truncated });
  if (!truncated) {
    return notifications.filter((n) => !n.read_at).length;
  }
  return serverCount;
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => notificationsApi.markRead(ids).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead().then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export interface NotificationsPageFilters {
  page: number;
  limit: number;
  unreadOnly: boolean;
  /** Notification type filter (`''` = all types). */
  type: string;
}

/** Paginated, filterable query backing the notification center page. */
export function useNotificationsPage(filters: NotificationsPageFilters) {
  const { page, limit, unreadOnly, type } = filters;
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, 'center', page, limit, unreadOnly, type],
    queryFn: () =>
      notificationsApi
        .list({ page, limit, unreadOnly: unreadOnly || undefined, type: type || undefined })
        .then((res) => res.data),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
