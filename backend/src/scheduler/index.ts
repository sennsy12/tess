import cron from 'node-cron';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { query } from '../db/index.js';

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
    const startTime = Date.now();
    config.status = 'running';
    config.lastRun = new Date();
    
    try {
      console.log(`🕐 Starting scheduled job: ${name}`);
      await task();
      const duration = Date.now() - startTime;
      logJob(id, 'success', `Job completed successfully`, duration);
      console.log(`✅ Job ${name} completed in ${duration}ms`);
      config.status = 'idle';
      config.lastError = undefined;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      config.status = 'error';
      config.lastError = error.message;
      logJob(id, 'error', error.message, duration);
      console.error(`❌ Job ${name} failed:`, error.message);
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
      entry.config.status = 'idle';
    } catch (error: any) {
      const duration = Date.now() - startTime;
      entry.config.status = 'error';
      entry.config.lastError = error.message;
      logJob(id, 'error', error.message, duration);
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
 * Initialize default scheduled jobs
 */
export function initializeDefaultJobs() {
  // Test data refresh - every day at 2 AM
  const testDataTask = async () => {
    await generateTestData();
    await insertTestData();
  };
  taskRegistry.set('refresh-test-data', testDataTask);
  createJob('refresh-test-data', 'Refresh Test Data', '0 2 * * *', testDataTask);

  // Real data sync - every 6 hours
  const realDataTask = async () => {
    await generateRealData();
    await insertRealData();
  };
  taskRegistry.set('sync-real-data', realDataTask);
  createJob('sync-real-data', 'Sync Real Data', '0 */6 * * *', realDataTask);

  // Database cleanup - every Sunday at 3 AM
  const cleanupTask = async () => {
    // Example: Clean up old order references or logs
    await query(`
      DELETE FROM ordre_henvisning 
      WHERE ordrenr IN (
        SELECT ordrenr FROM ordre WHERE dato < CURRENT_DATE - INTERVAL '2 years'
      )
    `);
  };
  taskRegistry.set('db-cleanup', cleanupTask);
  createJob('db-cleanup', 'Database Cleanup', '0 3 * * 0', cleanupTask);

  // Statistics aggregation - every hour
  const statsTask = async () => {
    // Pre-compute common statistics
    console.log('Aggregating statistics...');
    // Could store cached results in a separate table
  };
  taskRegistry.set('aggregate-stats', statsTask);
  createJob('aggregate-stats', 'Aggregate Statistics', '0 * * * *', statsTask);

  console.log('📅 Scheduler initialized with default jobs');
}
