import { Request, Response } from 'express';
import {
  subscribeToJob,
  getJobAsync,
  listJobsAsync,
  cancelJob,
} from '../../etl/jobRegistry.js';
import { getLastFailureForJob } from '../../etl/etlFailures.js';
import { computeEtlProgressPercent } from '../../lib/etlProgress.js';
import type { EtlJobProgress } from '../../etl/streaming/types.js';

function withEtlProgressFields(job: EtlJobProgress) {
  return {
    ...job,
    progressPercent: computeEtlProgressPercent(job.attemptedRows, job.estimatedTotal),
  };
}

export const etlJobHandlers = {
  cancelJob: async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'jobId required' });
      return;
    }
    const job = await getJobAsync(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    cancelJob(jobId);
    res.json({ success: true, message: 'Job cancellation requested', jobId });
  },

  listJobs: async (req: Request, res: Response) => {
    const raw = req.query?.limit;
    const limit = Math.min(Number(typeof raw === 'string' ? raw : undefined) || 100, 500);
    const jobs = await listJobsAsync(limit);
    res.json({ jobs: jobs.map(withEtlProgressFields) });
  },

  getJob: async (req: Request, res: Response) => {
    const job = await getJobAsync(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const lastFailure = await getLastFailureForJob(req.params.jobId);
    res.json({ ...withEtlProgressFields(job), lastFailure: lastFailure ?? undefined });
  },

  jobProgressSSE: async (req: Request, res: Response) => {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'jobId required' });
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const unsubscribe = subscribeToJob(jobId, (progress) => {
      res.write(`data: ${JSON.stringify(withEtlProgressFields(progress))}\n\n`);
      const resWithFlush = res as Response & { flush?: () => void };
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush();
      }
    });

    const HEARTBEAT_INTERVAL_MS = 15_000;
    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(`: heartbeat ${Date.now()}\n\n`);
      const resWithFlush = res as Response & { flush?: () => void };
      if (typeof resWithFlush.flush === 'function') {
        resWithFlush.flush();
      }
    }, HEARTBEAT_INTERVAL_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
};
