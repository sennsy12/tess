import { z } from 'zod';

// ============================================================
// Auth validation schemas
// ============================================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});

export const loginKundeSchema = z.object({
  kundenr: z.string().min(1, 'Kundenr is required').max(50),
  password: z.string().min(1, 'Password is required').max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32, 'Refresh token is required').max(200),
});

export const revokeRefreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(200),
});

export const entraLoginSchema = z.object({
  // Entra ID tokens are ~1–2 KB JWTs; cap well above that, far below body limits.
  idToken: z.string().min(100).max(8000),
});
