import { Router, Request, Response } from 'express';
import { authMiddleware, roleGuard, AuthRequest } from '../middleware/auth.js';
import {
  getAllJobs,
  startJob,
  stopJob,
  runJobNow,
  getJobLogs,
  createJob,
  ScheduledJob,
} from '../scheduler/index.js';

export const schedulerRouter = Router();

// All scheduler routes require admin access
schedulerRouter.use(authMiddleware, roleGuard('admin'));

// Get all scheduled jobs
schedulerRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = getAllJobs();
    res.json(jobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start a job
schedulerRouter.post('/jobs/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = startJob(id);
    if (success) {
      res.json({ success: true, message: `Job ${id} started` });
    } else {
      res.status(404).json({ success: false, error: `Job ${id} not found` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stop a job
schedulerRouter.post('/jobs/:id/stop', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = stopJob(id);
    if (success) {
      res.json({ success: true, message: `Job ${id} stopped` });
    } else {
      res.status(404).json({ success: false, error: `Job ${id} not found` });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Run a job immediately
schedulerRouter.post('/jobs/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await runJobNow(id);
    res.json({ success: true, message: `Job ${id} executed` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get job logs
schedulerRouter.get('/logs', async (req: Request, res: Response) => {
  try {
    const { jobId, limit } = req.query;
    const logs = getJobLogs(jobId as string, limit ? parseInt(limit as string) : undefined);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a custom job
schedulerRouter.post('/jobs', async (req: Request, res: Response) => {
  try {
    const { id, name, cronExpression, taskType } = req.body;
    
    if (!id || !name || !cronExpression || !taskType) {
      return res.status(400).json({ error: 'Missing required fields: id, name, cronExpression, taskType' });
    }

    // For now, only allow predefined task types
    const allowedTasks = ['refresh-test-data', 'sync-real-data', 'db-cleanup', 'aggregate-stats'];
    if (!allowedTasks.includes(taskType)) {
      return res.status(400).json({ error: `Invalid taskType. Allowed: ${allowedTasks.join(', ')}` });
    }

    res.json({ success: true, message: `Custom job creation not fully implemented` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
