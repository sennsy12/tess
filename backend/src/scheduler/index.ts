import cron from 'node-cron';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { query } from '../db/index.js';
import { refreshStatisticsAggregates } from '../services/statsAggregateService.js';
import { isSchedulerJobsEnabled } from '../middleware/productionSafety.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { schedulerJobRunsTotal } from '../metrics/prometheus.js';

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
  lastError?: string;
}

// Store for scheduled jobs
const scheduledJobs: Map<string, { job: cron.ScheduledTask; config: ScheduledJob }> = new Map();
const jobLogs: Array<{ jobId: string; timestamp: Date; status: string; message: string; duration?: number }> = [];

/**
 * Log job execution
 */
function logJob(jobId: string, status: string, message: string, duration?: number) {
  jobLogs.unshift({ jobId, timestamp: new Date(), status, message, duration });
  // Keep only last 100 logs
  if (jobLogs.length > 100) {
    jobLogs.pop();
  }
}

/**
 * Best-effort Prometheus observation for job outcomes. Metrics must never
 * break job execution, so inc failures are swallowed (debug-logged only).
 */
function observeJobRun(jobId: string, status: 'success' | 'error' | 'skipped'): void {
  try {
    schedulerJobRunsTotal.inc({ job_id: jobId, status });
  } catch (err) {
    logger.debug({ err, jobId, status }, 'Scheduler metric inc failed (best-effort)');
  }
}

/**
 * Create a scheduled job
 */
export function createJob(
  id: string,
  name: string,
  cronExpression: string,
  task: () => Promise<any>
): ScheduledJob {
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  // Stop existing job if exists
  if (scheduledJobs.has(id)) {
    const existing = scheduledJobs.get(id);
    existing?.job.stop();
  }

  const config: ScheduledJob = {
    id,
    name,
    cronExpression,
    enabled: false,
    status: 'idle',
  };

  const job = cron.schedule(cronExpression, async () => {
    // Overlap guard: a tick that outlasts its interval (e.g. an hourly stats
    // refresh taking 70 minutes) must not run against itself.
    if (config.status === 'running') {
      logger.warn({ jobId: id, name }, 'Scheduled job still running — skipping this tick');
      logJob(id, 'skipped', 'Skipped: previous run still in progress');
      observeJobRun(id, 'skipped');
      return;
    }
    const startTime = Date.now();
    config.status = 'running';
    config.lastRun = new Date();

    try {
      logger.info({ jobId: id, name }, 'Starting scheduled job');
      await task();
      const duration = Date.now() - startTime;
      logJob(id, 'success', `Job completed successfully`, duration);
      logger.info({ jobId: id, name, durationMs: duration }, 'Scheduled job completed');
      observeJobRun(id, 'success');
      config.status = 'idle';
      config.lastError = undefined;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      config.status = 'error';
      config.lastError = error.message;
      logJob(id, 'error', error.message, duration);
      logger.error({ err: error, jobId: id, name, durationMs: duration }, 'Scheduled job failed');
      observeJobRun(id, 'error');
    }
  }, {
    scheduled: false, // Don't start automatically
    timezone: 'Europe/Oslo',
  });

  scheduledJobs.set(id, { job, config });
  return config;
}

/**
 * Start a job
 */
export function startJob(id: string): boolean {
  const entry = scheduledJobs.get(id);
  if (!entry) return false;
  
  entry.job.start();
  entry.config.enabled = true;
  logJob(id, 'info', 'Job started');
  return true;
}

/**
 * Stop a job
 */
export function stopJob(id: string): boolean {
  const entry = scheduledJobs.get(id);
  if (!entry) return false;
  
  entry.job.stop();
  entry.config.enabled = false;
  logJob(id, 'info', 'Job stopped');
  return true;
}

/**
 * Run a job immediately (manual trigger)
 */
export async function runJobNow(id: string): Promise<void> {
  const entry = scheduledJobs.get(id);
  if (!entry) throw new Error(`Job not found: ${id}`);

  // Mutual exclusion with the cron tick — both share config.status.
  // Warn first (same overlap signal as the cron-tick guard), then fail closed.
  if (entry.config.status === 'running') {
    logger.warn({ jobId: id }, 'Manual job run skipped — previous run still in progress');
    observeJobRun(id, 'skipped');
    throw new AppError('Job is already running', 409);
  }

  // Trigger the job task manually
  const task = getJobTask(id);
  if (task) {
    const startTime = Date.now();
    entry.config.status = 'running';
    entry.config.lastRun = new Date();

    try {
      await task();
      const duration = Date.now() - startTime;
      logJob(id, 'success', 'Manual run completed', duration);
      observeJobRun(id, 'success');
      entry.config.status = 'idle';
    } catch (error: any) {
      const duration = Date.now() - startTime;
      entry.config.status = 'error';
      entry.config.lastError = error.message;
      logJob(id, 'error', error.message, duration);
      observeJobRun(id, 'error');
      throw error;
    }
  }
}

/**
 * Get all jobs
 */
export function getAllJobs(): ScheduledJob[] {
  return Array.from(scheduledJobs.values()).map(entry => entry.config);
}

/**
 * Get job logs
 */
export function getJobLogs(jobId?: string, limit: number = 50) {
  if (jobId) {
    return jobLogs.filter(log => log.jobId === jobId).slice(0, limit);
  }
  return jobLogs.slice(0, limit);
}

// Task registry for manual execution
const taskRegistry: Map<string, () => Promise<any>> = new Map();

function getJobTask(id: string): (() => Promise<any>) | undefined {
  return taskRegistry.get(id);
}

/**
 * Stop all scheduled cron tasks (for graceful shutdown).
 */
export function stopAllJobs(): void {
  for (const [id, entry] of scheduledJobs) {
    entry.job.stop();
    entry.config.enabled = false;
    logJob(id, 'info', 'Job stopped (shutdown)');
  }
}

/**
 * Initialize default scheduled jobs.
 * Destructive jobs (test data, cleanup) are only registered when ENABLE_SCHEDULER_JOBS=true
 * or outside production.
 */
export function initializeDefaultJobs() {
  const allowDestructiveJobs = isSchedulerJobsEnabled();

  if (allowDestructiveJobs) {
    const testDataTask = async () => {
      await generateTestData();
      await insertTestData();
    };
    taskRegistry.set('refresh-test-data', testDataTask);
    createJob('refresh-test-data', 'Refresh Test Data', '0 2 * * *', testDataTask);

    const realDataTask = async () => {
      await generateRealData();
      await insertRealData();
    };
    taskRegistry.set('sync-real-data', realDataTask);
    createJob('sync-real-data', 'Sync Real Data', '0 */6 * * *', realDataTask);

    // Honest naming: this only purges denormalized reference rows belonging
    // to old orders. Parent ordre/ordrelinje rows are intentionally kept —
    // this reclaims no space in the fact tables.
    const cleanupTask = async () => {
      await query(`
        DELETE FROM ordre_henvisning
        WHERE ordrenr IN (
          SELECT ordrenr FROM ordre WHERE dato < CURRENT_DATE - INTERVAL '2 years'
        )
      `);
    };
    taskRegistry.set('purge-old-order-references', cleanupTask);
    createJob('purge-old-order-references', 'Purge Old Order References (2y+)', '0 3 * * 0', cleanupTask);
  } else {
    logger.info('Destructive scheduler jobs skipped (production default)');
  }

  const statsTask = async () => {
    await refreshStatisticsAggregates();
  };
  taskRegistry.set('aggregate-stats', statsTask);
  createJob('aggregate-stats', 'Aggregate Statistics', '0 * * * *', statsTask);

  logger.info({ destructiveJobs: allowDestructiveJobs }, 'Scheduler initialized');
}
