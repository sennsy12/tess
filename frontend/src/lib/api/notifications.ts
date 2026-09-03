import api from './client';
import type { AppNotification } from '../../types/notification';
import type { PaginatedResponse } from './types';

export const notificationsApi = {
  list: (params?: { page?: number; limit?: number; unreadOnly?: boolean; type?: string }) =>
    api.get<PaginatedResponse<AppNotification>>('/notifications', { params }),

  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (ids: number[]) =>
    api.post<{ marked: number }>('/notifications/mark-read', { ids }),

  markAllRead: () => api.post<{ marked: number }>('/notifications/mark-all-read'),

  markOneRead: (id: number) => api.post<{ ok: boolean }>(`/notifications/${id}/read`),
};
