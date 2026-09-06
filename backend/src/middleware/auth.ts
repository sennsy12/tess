import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getJwtSecret, JWT_ALGORITHMS } from '../lib/jwt.js';
import { userModel } from '../models/userModel.js';
import { logger } from '../lib/logger.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'kunde' | 'analyse';
    kundenr?: string;
    tokenVersion?: number;
  };
}

/** JWT claims from login; DB may store null kundenr for non-customer roles. */
export const jwtPayloadSchema = z
  .object({
    id: z.coerce.number(),
    username: z.string().min(1),
    role: z.enum(['admin', 'kunde', 'analyse']),
    kundenr: z.string().nullish(),
    tokenVersion: z.coerce.number().int().min(0).optional(),
  })
  .transform(({ id, username, role, kundenr, tokenVersion }) => ({
    id,
    username,
    role,
    ...(kundenr != null ? { kundenr } : {}),
    ...(tokenVersion !== undefined ? { tokenVersion } : {}),
  }));

// ── token_version check ──────────────────────────────────────────────
// A bump (password change) must invalidate outstanding access tokens.
// Checking the DB on every request costs one indexed primary-key lookup;
// a short TTL cache keeps that off the hot path while still revoking
// sessions within CACHE_TTL_MS of the bump.

const VERSION_CACHE_TTL_MS = 30_000;
const versionCache = new Map<number, { value: number | null; at: number }>();

/** Overridable in tests. */
export const tokenVersionProvider = {
  get: (userId: number) => userModel.getTokenVersion(userId),
};

export function invalidateTokenVersionCache(userId?: number): void {
  if (userId === undefined) versionCache.clear();
  else versionCache.delete(userId);
}

async function getCurrentTokenVersion(userId: number): Promise<number | null> {
  const cached = versionCache.get(userId);
  if (cached && Date.now() - cached.at < VERSION_CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await tokenVersionProvider.get(userId);
  versionCache.set(userId, { value, at: Date.now() });
  return value;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: [...JWT_ALGORITHMS] });
    const parsed = jwtPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Reject tokens issued before a token_version bump (password change).
    // A missing DB row means the user was deleted → reject.
    // Fail closed: if the version check cannot be performed (transient DB
    // failure), the request is rejected — a revoked token must never be
    // honoured, even during an outage. Clients should retry.
    try {
      const currentVersion = await getCurrentTokenVersion(parsed.data.id);
      if (currentVersion === null) {
        return res.status(401).json({ error: 'Unknown user' });
      }
      // Legacy tokens issued before tokenVersion existed carry no version.
      // Rejecting them outright would sign out every old session at once
      // (destructive), so they stay valid until rotation — warn for
      // observability. New tokens MUST always include tokenVersion
      // (see jwtClaimsFromUser in authController).
      if (parsed.data.tokenVersion === undefined) {
        logger.warn({ userId: parsed.data.id }, 'Legacy token without tokenVersion accepted');
      }
      if (
        parsed.data.tokenVersion !== undefined &&
        parsed.data.tokenVersion !== currentVersion
      ) {
        return res.status(401).json({ error: 'Token revoked, please sign in again' });
      }
    } catch (dbErr) {
      logger.error({ err: dbErr, userId: parsed.data.id }, 'Token version check failed closed');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    req.user = parsed.data;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const roleGuard = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};
