import { EtlJobProgress, EtlJobStatus, EtlSourceType } from './streaming/types.js';

const jobs = new Map<string, EtlJobProgress>();
const abortControllers = new Map<string, AbortController>();
const MAX_JOBS = 500;

export function registerJob(jobId: string, table: string, sourceType: EtlSourceType): void {
  const existing = jobs.get(jobId);
  if (existing && existing.status === 'running') {
    throw new Error(`Job already running with this jobId: ${jobId}`);
  }
  const now = new Date().toISOString();
  jobs.set(jobId, {
    jobId,
    status: 'running',
    table,
    sourceType,
    attemptedRows: 0,
    insertedRows: 0,
    rejectedRows: 0,
    deadLetterCount: 0,
    startedAt: now,
    updatedAt: now,
  });
  pruneOldJobs();
}

export function updateJobProgress(
  jobId: string,
  update: Partial<Pick<EtlJobProgress, 'attemptedRows' | 'insertedRows' | 'rejectedRows' | 'deadLetterCount' | 'estimatedTotal'>>
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, update, { updatedAt: new Date().toISOString() });
}

export function completeJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'completed';
  job.updatedAt = new Date().toISOString();
}

export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'failed';
  job.error = error;
  job.updatedAt = new Date().toISOString();
}

export function setJobAbortController(jobId: string, controller: AbortController): void {
  abortControllers.set(jobId, controller);
}

export function clearJobAbortController(jobId: string): void {
  abortControllers.delete(jobId);
}

export function cancelJob(jobId: string, reason?: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  abortControllers.get(jobId)?.abort();
  abortControllers.delete(jobId);
  job.status = 'cancelled';
  if (reason !== undefined) job.error = reason;
  job.updatedAt = new Date().toISOString();
}

export function getJob(jobId: string): EtlJobProgress | null {
  return jobs.get(jobId) ?? null;
}

export function listJobs(limit = 100): EtlJobProgress[] {
  return Array.from(jobs.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function pruneOldJobs(): void {
  if (jobs.size <= MAX_JOBS) return;
  const entries = Array.from(jobs.entries())
    .sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime());
  entries.slice(MAX_JOBS).forEach(([id]) => jobs.delete(id));
}

// SSE: subscribers per job (or global)
type Subscriber = (progress: EtlJobProgress) => void;
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribeToJob(jobId: string, fn: Subscriber): () => void {
  if (!subscribers.has(jobId)) subscribers.set(jobId, new Set());
  subscribers.get(jobId)!.add(fn);
  const job = jobs.get(jobId);
  if (job) fn(job);
  return () => {
    subscribers.get(jobId)?.delete(fn);
    if (subscribers.get(jobId)?.size === 0) subscribers.delete(jobId);
  };
}

export function broadcastProgress(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  subscribers.get(jobId)?.forEach((fn) => fn(job));
}
