import api from './client';
import { Order } from '../../types/order';
import type { PaginatedResponse } from './types';

export type OrdersListResponse = PaginatedResponse<Order>;

export const ordersApi = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<OrdersListResponse>('/orders', { params }),
  getOne: (ordrenr: number) => api.get(`/orders/${ordrenr}`),
  searchByReferences: (q: string) => api.get('/orders/search/references', { params: { q } }),
  updateStatus: (ordrenr: number, workflowStatus: string, comment?: string) =>
    api.patch(`/orders/${ordrenr}/status`, comment ? { workflowStatus, comment } : { workflowStatus }),
  /** Workflow timeline: who/when/from→to/comment (kunde-scoped on the server). */
  getHistory: (ordrenr: number) => api.get<{ data: import('../../types/order').OrderStatusHistoryEntry[] }>(`/orders/${ordrenr}/history`),
  listStatuses: () => api.get<{ value: string; label: string }[]>('/orders/statuses'),
  /** Place a customer order from the cart. Server re-prices all items. */
  create: (data: CreateOrderPayload) => api.post<CreateOrderResponse>('/orders', data),
  /** Cancel an order still awaiting approval (owning kunde or admin). */
  cancel: (ordrenr: number) => api.patch(`/orders/${ordrenr}/cancel`),
};

export interface CreateOrderItemPayload {
  varekode: string;
  antall: number;
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[];
  kundeordreref?: string;
  kunderef?: string;
  lagernavn?: string;
  valutaid?: string;
  /** Unique per attempt — protects against double submits. */
  idempotencyKey: string;
  /** Admin-only: place the order on behalf of this customer. */
  kundenr?: string;
}

export interface CreateOrderResponse {
  ordrenr: number;
  kundenr: string;
  workflow_status: string;
  sum: number;
  duplicate: boolean;
}

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
