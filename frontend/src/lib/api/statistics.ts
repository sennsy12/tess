import api from './client';

// ============================================
// TYPES
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StatisticsSummary {
  totalOrders: number;
  totalRevenue: number;
  activeCustomers: number;
  productsOrdered: number;
  topCustomer: {
    kundenavn: string;
    total: number;
  } | null;
}

export interface TimeSeriesPoint {
  period: string;
  order_count: number;
  total_sum: number;
}

export interface KundeStats {
  kundenr: string;
  kundenavn: string;
  order_count: number;
  total_sum: number;
  avg_order_value: number;
}

export interface VaregruppeStats {
  varegruppe: string;
  order_count: number;
  total_quantity: number;
  total_sum: number;
}

export interface VareStats {
  varekode: string;
  varenavn: string;
  varegruppe: string;
  order_count: number;
  total_quantity: number;
  total_sum: number;
}

export interface LagerStats {
  lagernavn: string;
  firmanavn: string;
  order_count: number;
  total_sum: number;
}

export interface FirmaStats {
  firmaid: number;
  firmanavn: string;
  order_count: number;
  total_sum: number;
}

export interface StatisticsBatchResponse {
  summary: StatisticsSummary;
  timeSeries: TimeSeriesPoint[];
  kunde: PaginatedResponse<KundeStats>;
  varegruppe: PaginatedResponse<VaregruppeStats>;
}

export interface DashboardAnalyticsBatchResponse {
  summary: StatisticsSummary;
  timeSeries: TimeSeriesPoint[];
  firma: PaginatedResponse<FirmaStats>;
  lager: PaginatedResponse<LagerStats>;
}

// ============================================
// API
// ============================================

export const statisticsApi = {
  byKunde: (params?: Record<string, any> & PaginationParams) =>
    api.get<PaginatedResponse<KundeStats>>('/statistics/by-kunde', { params }),
  byVaregruppe: (params?: Record<string, any> & PaginationParams) =>
    api.get<PaginatedResponse<VaregruppeStats>>('/statistics/by-varegruppe', { params }),
  byVare: (params?: Record<string, any> & PaginationParams) =>
    api.get<PaginatedResponse<VareStats>>('/statistics/by-vare', { params }),
  byLager: (params?: Record<string, any> & PaginationParams) =>
    api.get<PaginatedResponse<LagerStats>>('/statistics/by-lager', { params }),
  byFirma: (params?: Record<string, any> & PaginationParams) =>
    api.get<PaginatedResponse<FirmaStats>>('/statistics/by-firma', { params }),
  timeSeries: (params?: Record<string, any>) =>
    api.get<TimeSeriesPoint[]>('/statistics/time-series', { params }),
  summary: (params?: Record<string, any>) =>
    api.get<StatisticsSummary>('/statistics/summary', { params }),
  batch: (params?: Record<string, any>) =>
    api.get<StatisticsBatchResponse>('/statistics/batch', { params }),
  getCustom: (params: Record<string, any>) => api.get('/statistics/custom', { params }),
};
