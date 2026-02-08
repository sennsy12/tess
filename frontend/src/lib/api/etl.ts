import api from './client';

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
};
