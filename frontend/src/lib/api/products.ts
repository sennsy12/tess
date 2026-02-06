import api from './client';

export const productsApi = {
  getAll: (params?: Record<string, any>) => api.get('/products', { params }),
  getGroups: () => api.get('/products/groups'),
  getOne: (varekode: string) => api.get(`/products/${varekode}`),
};
