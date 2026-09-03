import api from './client';

export const statusApi = {
  getStatus: () => api.get('/status'),
  getImportStatus: () => api.get('/status/import'),
  getExtractionStatus: () => api.get('/status/extraction'),
  getHealth: () => api.get('/status/health'),
  getApiMetrics: () => api.get('/status/api-metrics'),
  getEtlMetrics: () => api.get('/status/etl-metrics'),
  getRecentActivity: (days = 7) => api.get('/status/recent-activity', { params: { days } }),
};
