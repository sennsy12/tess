import api from './client';

export const auditApi = {
  getAll: (params?: Record<string, any>) => api.get('/audit', { params }),
  getByEntity: (entityType: string, entityId: string) =>
    api.get(`/audit/${entityType}/${entityId}`),
};
