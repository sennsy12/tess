import api from './client';
import { Order } from '../../types/order';
import type { PaginatedResponse } from './types';

export type OrdersListResponse = PaginatedResponse<Order>;

export const ordersApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<OrdersListResponse>('/orders', { params }),
  getOne: (ordrenr: number) => api.get(`/orders/${ordrenr}`),
  searchByReferences: (q: string) => api.get('/orders/search/references', { params: { q } }),
  updateStatus: (ordrenr: number, workflowStatus: string) =>
    api.patch(`/orders/${ordrenr}/status`, { workflowStatus }),
  listStatuses: () => api.get<{ value: string; label: string }[]>('/orders/statuses'),
};

export const orderlinesApi = {
  getByOrder: (ordrenr: number, params?: { page?: number; limit?: number }) =>
    api.get(`/orderlines/order/${ordrenr}`, { params }),
  create: (data: Record<string, unknown>) => api.post('/orderlines', data),
  update: (ordrenr: number, linjenr: number, data: Record<string, unknown>) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}`, data),
  delete: (ordrenr: number, linjenr: number) =>
    api.delete(`/orderlines/${ordrenr}/${linjenr}`),
  updateReferences: (ordrenr: number, linjenr: number, data: Record<string, unknown>) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}/references`, data),
};
