import api from './client';

export const customersApi = {
  getAll: () => api.get('/customers'),
  getOne: (kundenr: string) => api.get(`/customers/${kundenr}`),
};
