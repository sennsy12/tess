import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { suggestionController } from '../controllers/suggestionController.js';

export const suggestionsRouter = Router();

// All suggestions routes require authentication
suggestionsRouter.use(authMiddleware);

// Get search suggestions based on query
suggestionsRouter.get('/search', suggestionController.search);
