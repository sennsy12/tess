import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import {
  getAllJobs,
  startJob,
  stopJob,
  runJobNow,
  getJobLogs,
} from '../scheduler/index.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';

// Navngitte konstanter for tidligere inline verdier (samme verdier/oppførsel).
// Ingen ruter slettes; stubben POST /jobs beholdes (deprecated-merknad under).
const SCHEDULER_LOGS_MAX_LIMIT = 100; // matcher logJob-retensjon (beholder kun siste 100)
const ALLOWED_SCHEDULER_TASK_TYPES = [
  'refresh-test-data',
  'sync-real-data',
  'purge-old-order-references',
  'aggregate-stats',
] as const;

// Zod for POST /jobs — samme feilmeldinger som før (HTTP 400 via ValidationError).
const createCustomJobSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cronExpression: z.string().min(1),
  taskType: z.string().min(1),
});

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
  // Trygg parsing uten nye feil: ugyldig limit faller tilbake til service-default
  // (tidligere NaN ga tom liste via slice(0, NaN)); gyldige verdier clamps til retensjon.
  const parsedLimit = limit === undefined ? undefined : parseInt(limit as string, 10);
  const safeLimit =
    parsedLimit === undefined
      ? undefined
      : Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), SCHEDULER_LOGS_MAX_LIMIT)
        : undefined;
  const logs = getJobLogs(jobId as string, safeLimit);
  res.json(logs);
}));

// Create a custom job
// @deprecated Stub — ikke fullt implementert (returnerer alltid suksess-melding).
// Beholdes bakoverkompatibelt; ikke fjern uten major + frontend-avklaring.
schedulerRouter.post('/jobs', asyncHandler(async (req: Request, res: Response) => {
  const parsed = createCustomJobSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Missing required fields: id, name, cronExpression, taskType');
  }
  const { taskType } = parsed.data;

  // For now, only allow predefined task types
  if (!(ALLOWED_SCHEDULER_TASK_TYPES as readonly string[]).includes(taskType)) {
    throw new ValidationError(`Invalid taskType. Allowed: ${ALLOWED_SCHEDULER_TASK_TYPES.join(', ')}`);
  }

  res.json({ success: true, message: `Custom job creation not fully implemented` });
}));

