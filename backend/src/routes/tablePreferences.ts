import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { tablePreferencesController } from '../controllers/tablePreferencesController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, tableKeyParamSchema, tablePreferencesBodySchema } from '../middleware/validation.js';

export const tablePreferencesRouter = Router();

// Alle roller har egne preferanser (samme mønster som /reports).
tablePreferencesRouter.use(authMiddleware);

tablePreferencesRouter.get(
  '/:tableKey',
  validate(tableKeyParamSchema, 'params'),
  asyncHandler(tablePreferencesController.getPreferences),
);

tablePreferencesRouter.put(
  '/:tableKey',
  validate(tableKeyParamSchema, 'params'),
  validate(tablePreferencesBodySchema),
  asyncHandler(tablePreferencesController.savePreferences),
);
