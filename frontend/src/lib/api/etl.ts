import api from './client';
import type { EtlJobDetail, EtlJobsListResponse } from '../../types/etlJob';

export const etlApi = {
  createDB: () => api.get('/etl/createDB'),
  truncateDB: () => api.get('/etl/truncateDB'),
  generateTestData: () => api.get('/etl/generateTestData'),
  insertTestData: () => api.get('/etl/insertTestData'),
  generateRealData: () => api.get('/etl/generateRealData'),
  insertRealData: () => api.get('/etl/insertRealData'),
  runFullTestPipeline: () => api.get('/etl/runFullTestPipeline'),
  // Bulk data APIs for millions of rows
  generateBulkData: (config: { customers?: number; orders?: number; linesPerOrder?: number; actionKey?: string }) =>
    api.post('/etl/generateBulkData', config),
  insertBulkData: () => api.get('/etl/insertBulkData'),
  tableCounts: () => api.get('/etl/tableCounts'),
  runBulkPipeline: (config: { customers?: number; orders?: number; linesPerOrder?: number; actionKey?: string }) =>
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
  uploadXlsx: (table: string, file: File, sheet?: string) => {
    const formData = new FormData();
    formData.append('table', table);
    if (sheet) formData.append('sheet', sheet);
    formData.append('file', file);
    return api.post('/etl/upload-xlsx', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  listJobs: (limit = 50) =>
    api.get<EtlJobsListResponse>('/etl/jobs', { params: { limit } }),

  getJob: (jobId: string) => api.get<EtlJobDetail>(`/etl/jobs/${encodeURIComponent(jobId)}`),

  cancelJob: (jobId: string) =>
    api.post<{ success: boolean; message: string; jobId: string }>(
      `/etl/jobs/${encodeURIComponent(jobId)}/cancel`,
    ),
};
