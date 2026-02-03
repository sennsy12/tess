import { Router, Request, Response } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import {
  getAllJobs,
  startJob,
  stopJob,
  runJobNow,
  getJobLogs,
} from '../scheduler/index.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

export const schedulerRouter = Router();

// All scheduler routes require admin access
schedulerRouter.use(authMiddleware, roleGuard('admin'));

// Get all scheduled jobs
schedulerRouter.get('/jobs', asyncHandler(async (req: Request, res: Response) => {
  const jobs = getAllJobs();
  res.json(jobs);
}));

// Start a job
schedulerRouter.post('/jobs/:id/start', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const success = startJob(id);
  if (!success) {
    throw new NotFoundError(`Job ${id} not found`);
  }
  res.json({ success: true, message: `Job ${id} started` });
}));

// Stop a job
schedulerRouter.post('/jobs/:id/stop', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const success = stopJob(id);
  if (!success) {
    throw new NotFoundError(`Job ${id} not found`);
  }
  res.json({ success: true, message: `Job ${id} stopped` });
}));

// Run a job immediately
schedulerRouter.post('/jobs/:id/run', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await runJobNow(id);
  res.json({ success: true, message: `Job ${id} executed` });
}));

// Get job logs
schedulerRouter.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const { jobId, limit } = req.query;
  const logs = getJobLogs(jobId as string, limit ? parseInt(limit as string) : undefined);
  res.json(logs);
}));

// Create a custom job
schedulerRouter.post('/jobs', asyncHandler(async (req: Request, res: Response) => {
  const { id, name, cronExpression, taskType } = req.body;
  
  if (!id || !name || !cronExpression || !taskType) {
    throw new ValidationError('Missing required fields: id, name, cronExpression, taskType');
  }

  // For now, only allow predefined task types
  const allowedTasks = ['refresh-test-data', 'sync-real-data', 'db-cleanup', 'aggregate-stats'];
  if (!allowedTasks.includes(taskType)) {
    throw new ValidationError(`Invalid taskType. Allowed: ${allowedTasks.join(', ')}`);
  }

  res.json({ success: true, message: `Custom job creation not fully implemented` });
}));

