import api from './client';

export interface CatalogProduct {
  varekode: string;
  varenavn: string | null;
  varegruppe: string | null;
  base_price: number;
  unit_price: number;
  discount_applied: boolean;
  discount_percent: number | null;
  applied_rule_name: string | null;
}

export interface CatalogResponse {
  data: CatalogProduct[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  pricedFor: string | null;
}

export const catalogApi = {
  getAll: (params?: {
    search?: string;
    varegruppe?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    kundenr?: string;
  }) => api.get<CatalogResponse>('/catalog/products', { params }),
};
