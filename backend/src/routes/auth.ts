import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate, loginSchema, loginKundeSchema } from '../middleware/validation.js';

export const authRouter = Router();

// Login for admin/analyse users (rate limited)
authRouter.post('/login', 
  authLimiter, 
  validate(loginSchema), 
  asyncHandler(authController.login)
);

// Login for customers (rate limited)
authRouter.post('/login-kunde', 
  authLimiter, 
  validate(loginKundeSchema), 
  asyncHandler(authController.loginKunde)
);

// Verify token
authRouter.get('/verify', asyncHandler(authController.verify));
