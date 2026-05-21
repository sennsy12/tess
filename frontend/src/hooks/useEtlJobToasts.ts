import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useEtlJobsList } from './useEtlJobs';
import type { EtlJobStatus } from '../types/etlJob';

const TERMINAL: EtlJobStatus[] = ['completed', 'failed'];

/**
 * Shows admin toasts when ETL jobs transition to completed/failed.
 * Mount once in Layout for admin users.
 */
export function useEtlJobToasts(enabled: boolean) {
  const { data: jobs } = useEtlJobsList(30);
  const seenRef = useRef<Map<string, EtlJobStatus>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !jobs) return;

    if (!initializedRef.current) {
      for (const job of jobs) {
        seenRef.current.set(job.jobId, job.status);
      }
      initializedRef.current = true;
      return;
    }

    for (const job of jobs) {
      const prev = seenRef.current.get(job.jobId);
      seenRef.current.set(job.jobId, job.status);

      if (!prev || prev === job.status) continue;
      if (!TERMINAL.includes(job.status)) continue;
      if (TERMINAL.includes(prev)) continue;

      if (job.status === 'completed') {
        toast.success(`ETL fullført: ${job.table} (${job.insertedRows.toLocaleString('nb-NO')} rader)`);
      } else {
        toast.error(`ETL feilet: ${job.table}${job.error ? ` — ${job.error}` : ''}`);
      }
    }
  }, [enabled, jobs]);
}
