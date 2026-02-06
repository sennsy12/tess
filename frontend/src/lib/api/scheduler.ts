import api from './client';

export const schedulerApi = {
  getJobs: () => api.get('/scheduler/jobs'),
  startJob: (id: string) => api.post(`/scheduler/jobs/${id}/start`),
  stopJob: (id: string) => api.post(`/scheduler/jobs/${id}/stop`),
  runJob: (id: string) => api.post(`/scheduler/jobs/${id}/run`),
  getLogs: (jobId?: string, limit?: number) =>
    api.get('/scheduler/logs', { params: { jobId, limit } }),
};
