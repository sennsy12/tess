import api from './client';

export const productsApi = {
  getAll: (params?: Record<string, any>) => api.get('/products', { params }),
  search: (params: {
    search?: string;
    varegruppe?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) => api.get('/products/search', { params }),
  getGroups: () => api.get('/products/groups'),
  getOne: (varekode: string) => api.get(`/products/${varekode}`),
  /** Set the catalog base price for a product (admin). */
  updateBasePrice: (varekode: string, base_price: number) =>
    api.patch(`/products/${varekode}/price`, { base_price }),
};
