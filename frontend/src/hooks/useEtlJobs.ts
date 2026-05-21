import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { etlApi } from '../lib/api/etl';
import type { EtlPipelineJob, EtlJobStatus } from '../types/etlJob';

export const ETL_JOBS_QUERY_KEY = ['admin', 'etl-jobs'] as const;

function hasActiveJobs(jobs: EtlPipelineJob[] | undefined): boolean {
  return jobs?.some((j) => j.status === 'running' || j.status === 'pending') ?? false;
}

export function useEtlJobsList(limit = 50) {
  return useQuery({
    queryKey: [...ETL_JOBS_QUERY_KEY, limit],
    queryFn: () => etlApi.listJobs(limit).then((res) => res.data.jobs),
    placeholderData: (prev) => prev,
    refetchInterval: (query) => (hasActiveJobs(query.state.data) ? 2500 : false),
  });
}

export function useEtlJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: [...ETL_JOBS_QUERY_KEY, 'detail', jobId],
    queryFn: () => etlApi.getJob(jobId!).then((res) => res.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2500 : false;
    },
  });
}

export function useCancelEtlJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => etlApi.cancelJob(jobId).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ETL_JOBS_QUERY_KEY });
    },
  });
}

export type EtlJobFilter = 'all' | EtlJobStatus;

export function filterEtlJobs(jobs: EtlPipelineJob[], filter: EtlJobFilter): EtlPipelineJob[] {
  if (filter === 'all') return jobs;
  return jobs.filter((j) => j.status === filter);
}

export function countJobsByStatus(jobs: EtlPipelineJob[]): Record<EtlJobStatus, number> {
  const counts: Record<EtlJobStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const job of jobs) {
    counts[job.status] += 1;
  }
  return counts;
}
