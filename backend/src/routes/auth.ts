import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  validate,
  loginSchema,
  loginKundeSchema,
  changePasswordSchema,
  refreshTokenSchema,
  revokeRefreshTokenSchema,
  entraLoginSchema,
} from '../middleware/validation.js';

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

// Exchange a refresh token for a new access + refresh pair (rate limited)
authRouter.post(
  '/refresh',
  authLimiter,
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh)
);

// Revoke a refresh token (logout). Idempotent.
authRouter.post(
  '/logout',
  validate(revokeRefreshTokenSchema),
  asyncHandler(authController.logout)
);

// Verify token
authRouter.get('/verify', asyncHandler(authController.verify));

// Public Microsoft sign-in configuration (client/tenant IDs only, no secrets)
authRouter.get('/entra/config', asyncHandler(authController.entraConfig));

// Hybrid Microsoft sign-in: MSAL ID token -> local token pair (rate limited)
authRouter.post(
  '/entra',
  authLimiter,
  validate(entraLoginSchema),
  asyncHandler(authController.entraLogin)
);

// Change own password (authenticated)
authRouter.post(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
);
