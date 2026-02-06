import api from './client';

export const ordersApi = {
  getAll: (params?: Record<string, any>) => api.get('/orders', { params }),
  getOne: (ordrenr: number) => api.get(`/orders/${ordrenr}`),
  searchByReferences: (q: string) => api.get('/orders/search/references', { params: { q } }),
};

export const orderlinesApi = {
  getByOrder: (ordrenr: number, params?: { page?: number; limit?: number }) =>
    api.get(`/orderlines/order/${ordrenr}`, { params }),
  create: (data: any) => api.post('/orderlines', data),
  update: (ordrenr: number, linjenr: number, data: any) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}`, data),
  delete: (ordrenr: number, linjenr: number) =>
    api.delete(`/orderlines/${ordrenr}/${linjenr}`),
  updateReferences: (ordrenr: number, linjenr: number, data: any) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}/references`, data),
};
