import api from './client';

export const statusApi = {
  getStatus: () => api.get('/status'),
  getImportStatus: () => api.get('/status/import'),
  getExtractionStatus: () => api.get('/status/extraction'),
  getHealth: () => api.get('/status/health'),
  getApiMetrics: () => api.get('/status/api-metrics'),
};
