import api from './client';

export const reportsApi = {
  getAll: () => api.get('/reports'),
  save: (name: string, config: any) => api.post('/reports', { name, config }),
  delete: (id: number) => api.delete(`/reports/${id}`),
};
