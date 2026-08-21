import { z } from 'zod';

// ============================================================
// User management validation schemas
// ============================================================

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  role: z.enum(['admin', 'kunde', 'analyse'], { error: 'Role must be admin, kunde, or analyse' }),
  kundenr: z.string().max(50).optional(),
});

export const updateUserSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200).optional(),
  role: z.enum(['admin', 'kunde', 'analyse'], { error: 'Role must be admin, kunde, or analyse' }).optional(),
  kundenr: z.string().max(50).optional().nullable(),
  actionKey: z.string().min(1).max(200).optional(),
});

export const deleteUserSchema = z.object({
  actionKey: z.string().min(1, 'Action key is required').max(200),
});
