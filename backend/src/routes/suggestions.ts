import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { suggestionController } from '../controllers/suggestionController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { searchLimiter } from '../middleware/rateLimit.js';
import { validate, searchQuerySchema } from '../middleware/validation.js';

export const suggestionsRouter = Router();

// All suggestions routes require authentication
suggestionsRouter.use(authMiddleware);

// Get search suggestions based on query (rate limited)
suggestionsRouter.get('/search', 
  searchLimiter, 
  validate(searchQuerySchema, 'query'),
  asyncHandler(suggestionController.search)
);

