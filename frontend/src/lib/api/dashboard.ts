import api from './client';
import type { DashboardAnalyticsBatchResponse } from './statistics';

export const dashboardApi = {
  getWidgets: () => api.get('/dashboard/widgets'),
  getAnalyticsBatch: () => api.get<DashboardAnalyticsBatchResponse>('/dashboard/analytics'),
  getTopProducts: (limit?: number) => api.get('/dashboard/top-products', { params: { limit } }),
  getTopCustomers: (limit?: number) => api.get('/dashboard/top-customers', { params: { limit } }),
  getPriceDeviations: (limit?: number) => api.get('/dashboard/price-deviations', { params: { limit } }),
  getDataStatus: (days?: number) => api.get('/dashboard/data-status', { params: { days } }),
};
