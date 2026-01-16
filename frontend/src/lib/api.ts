import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  loginKunde: (kundenr: string, password: string) =>
    api.post('/auth/login/kunde', { kundenr, password }),
  verify: () => api.get('/auth/verify'),
};

// Orders API
export const ordersApi = {
  getAll: (params?: Record<string, any>) => api.get('/orders', { params }),
  getOne: (ordrenr: number) => api.get(`/orders/${ordrenr}`),
  searchByReferences: (q: string) => api.get('/orders/search/references', { params: { q } }),
};

// Order Lines API
export const orderlinesApi = {
  getByOrder: (ordrenr: number) => api.get(`/orderlines/order/${ordrenr}`),
  create: (data: any) => api.post('/orderlines', data),
  update: (ordrenr: number, linjenr: number, data: any) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}`, data),
  delete: (ordrenr: number, linjenr: number) =>
    api.delete(`/orderlines/${ordrenr}/${linjenr}`),
  updateReferences: (ordrenr: number, linjenr: number, data: any) =>
    api.put(`/orderlines/${ordrenr}/${linjenr}/references`, data),
};

// Statistics API
export const statisticsApi = {
  byKunde: (params?: Record<string, any>) => api.get('/statistics/by-kunde', { params }),
  byVaregruppe: (params?: Record<string, any>) => api.get('/statistics/by-varegruppe', { params }),
  byVare: (params?: Record<string, any>) => api.get('/statistics/by-vare', { params }),
  byLager: (params?: Record<string, any>) => api.get('/statistics/by-lager', { params }),
  byFirma: (params?: Record<string, any>) => api.get('/statistics/by-firma', { params }),
  timeSeries: (params?: Record<string, any>) => api.get('/statistics/time-series', { params }),
  summary: (params?: Record<string, any>) => api.get('/statistics/summary', { params }),
  getCustom: (params: Record<string, any>) => api.get('/statistics/custom', { params }),
};

// Status API (admin only)
export const statusApi = {
  getStatus: () => api.get('/status'),
  getImportStatus: () => api.get('/status/import'),
  getExtractionStatus: () => api.get('/status/extraction'),
  getHealth: () => api.get('/status/health'),
};

// Customers API
export const customersApi = {
  getAll: () => api.get('/customers'),
  getOne: (kundenr: string) => api.get(`/customers/${kundenr}`),
};

// Products API
export const productsApi = {
  getAll: (params?: Record<string, any>) => api.get('/products', { params }),
  getGroups: () => api.get('/products/groups'),
  getOne: (varekode: string) => api.get(`/products/${varekode}`),
};

// ETL API (admin only)
export const etlApi = {
  createDB: () => api.get('/etl/createDB'),
  truncateDB: () => api.get('/etl/truncateDB'),
  generateTestData: () => api.get('/etl/generateTestData'),
  insertTestData: () => api.get('/etl/insertTestData'),
  generateRealData: () => api.get('/etl/generateRealData'),
  insertRealData: () => api.get('/etl/insertRealData'),
  runFullTestPipeline: () => api.get('/etl/runFullTestPipeline'),
  // Bulk data APIs for millions of rows
  generateBulkData: (config: { customers?: number; orders?: number; linesPerOrder?: number }) =>
    api.post('/etl/generateBulkData', config),
  insertBulkData: () => api.get('/etl/insertBulkData'),
  tableCounts: () => api.get('/etl/tableCounts'),
  runBulkPipeline: (config: { customers?: number; orders?: number; linesPerOrder?: number }) =>
    api.post('/etl/runBulkPipeline', config),
  uploadCsv: (table: string, file: File) => {
    const formData = new FormData();
    formData.append('table', table);
    formData.append('file', file);
    return api.post('/etl/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};


// Saved Reports API
export const reportsApi = {
  getAll: () => api.get('/reports'),
  save: (name: string, config: any) => api.post('/reports', { name, config }),
  delete: (id: number) => api.delete(`/reports/${id}`),
};

// Scheduler API (admin only)
export const schedulerApi = {
  getJobs: () => api.get('/scheduler/jobs'),
  startJob: (id: string) => api.post(`/scheduler/jobs/${id}/start`),
  stopJob: (id: string) => api.post(`/scheduler/jobs/${id}/stop`),
  runJob: (id: string) => api.post(`/scheduler/jobs/${id}/run`),
  getLogs: (jobId?: string, limit?: number) =>
    api.get('/scheduler/logs', { params: { jobId, limit } }),
};

// Suggestions API (autocomplete)
export const suggestionsApi = {
  search: (q: string) => api.get('/suggestions/search', { params: { q } }),
};

export default api;
