import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/userModel.js';
import {
  refreshTokenModel,
  REFRESH_TOKEN_TTL_MS,
} from '../models/refreshTokenModel.js';
import { ValidationError, UnauthorizedError, ForbiddenError, ServiceUnavailableError, TooManyRequestsError } from '../middleware/errorHandler.js';
import { jwtPayloadSchema, invalidateTokenVersionCache, type AuthRequest } from '../middleware/auth.js';
import { getJwtSecret, JWT_ALGORITHMS } from '../lib/jwt.js';
import { getEntraConfig } from '../lib/entra.js';
import { verifyEntraIdToken, EntraVerificationError } from '../lib/entraVerify.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { auditService } from '../services/auditService.js';
import { getEnv } from '../lib/env.js';

/**
 * Per-account brute-force protection (progressive lockout).
 *
 * Counters live on the user row so the policy holds across IPs — the
 * IP-based authLimiter cannot stop distributed guessing. Lock state is
 * checked BEFORE the password compare; a locked account also burns the
 * dummy-hash compare so its timing profile matches a normal failure.
 */
function lockSecondsRemaining(lockedUntil: string | null | undefined): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 1000) : 0;
}

async function assertNotLocked(
  user: { username: string; id: number; locked_until?: string | null },
  method: string
): Promise<void> {
  const seconds = lockSecondsRemaining(user.locked_until);
  if (seconds > 0) {
    await auditService.logAuthEvent({
      action: 'LOGIN_FAILED',
      username: user.username,
      userId: user.id,
      metadata: { method, reason: 'locked_out', retryAfterSeconds: seconds },
    });
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    throw new TooManyRequestsError(
      `For mange mislykkede innloggingsforsøk. Prøv igjen om ca. ${minutes} min.`
    );
  }
}

async function recordLoginFailure(userId: number): Promise<void> {
  const env = getEnv();
  await userModel.recordFailedLogin(
    userId,
    env.AUTH_MAX_FAILED_ATTEMPTS,
    env.AUTH_LOCKOUT_BASE_SECONDS,
    env.AUTH_LOCKOUT_MAX_SECONDS
  );
}

/** Access tokens are short-lived; refresh tokens extend the session. */
const ACCESS_TOKEN_EXPIRES_IN = '1h';

function jwtClaimsFromUser(user: {
  id: number;
  username: string;
  role: string;
  kundenr?: string | null;
  token_version?: number;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    ...(user.kundenr != null ? { kundenr: user.kundenr } : {}),
    // Checked against the DB on every request; a bump invalidates old tokens
    tokenVersion: user.token_version ?? 0,
  };
}

function publicUserFromRecord(user: {
  id: number;
  username: string;
  role: string;
  kundenr?: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    ...(user.kundenr != null ? { kundenr: user.kundenr } : {}),
  };
}

/**
 * Pre-computed bcrypt hash of a random password. Compared against whenever a
 * login lookup fails so that response time does not reveal whether the
 * username/kundenr exists (timing side-channel / user enumeration).
 */
const DUMMY_PASSWORD_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.PxHqXn5rj1FJQKfTZpxGVoLkOV7W';

async function verifyPasswordOrDummy(password: string, hash: string | null): Promise<boolean> {
  return verifyPassword(password, hash ?? DUMMY_PASSWORD_HASH);
}

/** Issue an access + refresh token pair after successful credential checks.
 * New access tokens MUST always include tokenVersion (via jwtClaimsFromUser,
 * defaulting missing DB values to 0) so a later password-change bump can
 * revoke them. Legacy tokens without a version stay accepted by the
 * middleware (with a warn) to avoid mass logout — see auth middleware. */
async function issueTokenPair(
  user: Parameters<typeof jwtClaimsFromUser>[0]
): Promise<{ token: string; refreshToken: string }> {
  const token = jwt.sign(jwtClaimsFromUser(user), getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
  });
  const issued = await refreshTokenModel.create(user.id);
  return { token, refreshToken: issued.token };
}

export const authController = {
  login: async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const user = await userModel.findByUsername(username);

    if (!user) {
      // Burn the same bcrypt time as a real check to prevent user enumeration
      await verifyPasswordOrDummy(password, null);
      await auditService.logAuthEvent({
        action: 'LOGIN_FAILED',
        username,
        ipAddress: req.ip,
        metadata: { method: 'password', reason: 'unknown_user' },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await assertNotLocked(user, 'password');

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      await recordLoginFailure(user.id);
      await auditService.logAuthEvent({
        action: 'LOGIN_FAILED',
        username: user.username,
        userId: user.id,
        ipAddress: req.ip,
        metadata: { method: 'password', reason: 'bad_password' },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await userModel.resetFailedLogins(user.id);
    const { token, refreshToken } = await issueTokenPair(user);
    await auditService.logAuthEvent({
      action: 'LOGIN',
      username: user.username,
      userId: user.id,
      ipAddress: req.ip,
      metadata: { method: 'password' },
    });
    res.json({ token, refreshToken, user: publicUserFromRecord(user) });
  },

  loginKunde: async (req: Request, res: Response) => {
    const { kundenr, password } = req.body;

    if (!kundenr || !password) {
      throw new ValidationError('Kundenr and password are required');
    }

    const user = await userModel.findByKundenr(kundenr);

    if (!user) {
      // Burn the same bcrypt time as a real check to prevent kundenr enumeration
      await verifyPasswordOrDummy(password, null);
      await auditService.logAuthEvent({
        action: 'LOGIN_FAILED',
        username: kundenr,
        ipAddress: req.ip,
        metadata: { method: 'kunde', reason: 'unknown_kundenr' },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await assertNotLocked(user, 'kunde');

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      await recordLoginFailure(user.id);
      await auditService.logAuthEvent({
        action: 'LOGIN_FAILED',
        username: user.username,
        userId: user.id,
        ipAddress: req.ip,
        metadata: { method: 'kunde', reason: 'bad_password' },
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    await userModel.resetFailedLogins(user.id);
    const { token, refreshToken } = await issueTokenPair(user);
    await auditService.logAuthEvent({
      action: 'LOGIN',
      username: user.username,
      userId: user.id,
      ipAddress: req.ip,
      metadata: { method: 'kunde' },
    });
    res.json({ token, refreshToken, user: publicUserFromRecord(user) });
  },

  /**
   * Exchange a valid refresh token for a fresh access + refresh pair.
   * The presented token is consumed (rotated); reuse of a rotated token
   * fails and forces a new login.
   */
  refresh: async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const rotated = await refreshTokenModel.rotate(refreshToken);
    if (!rotated) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Reload claims so role/kundenr/token_version changes are picked up
    // instead of replaying stale data from the old access token.
    const user = await userModel.findByIdWithHash(rotated.userId);
    if (!user) {
      throw new UnauthorizedError('User no longer exists');
    }

    const token = jwt.sign(jwtClaimsFromUser(user), getJwtSecret(), {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      algorithm: 'HS256',
    });

    res.json({
      token,
      refreshToken: rotated.token,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      tokenType: 'Bearer',
      refreshExpiresInMs: REFRESH_TOKEN_TTL_MS,
    });
  },

  /** Revoke a refresh token (logout). Idempotent — safe to call repeatedly. */
  logout: async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      const { revoked, userId, username } = await refreshTokenModel.revoke(refreshToken);
      if (revoked) {
        await auditService.logAuthEvent({
          action: 'LOGOUT',
          username: username ?? 'unknown',
          userId,
          ipAddress: req.ip,
          metadata: { method: 'refresh-token' },
        });
      }
    }
    res.json({ success: true });
  },

  changePassword: async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await userModel.findByIdWithHash(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    await userModel.update(userId, { passwordHash });

    await auditService.logAuthEvent({
      action: 'PASSWORD_CHANGE',
      username: user.username,
      userId,
      ipAddress: req.ip,
      metadata: { method: 'self' },
    });

    // Invalidate every existing session for this user:
    // - bump token_version → all previously issued access tokens fail the
    //   version check in auth middleware immediately
    // - revoke all refresh tokens → no new access tokens can be obtained
    await userModel.bumpTokenVersion(userId);
    invalidateTokenVersionCache(userId);
    await refreshTokenModel.revokeAllForUser(userId);

    res.json({
      success: true,
      message: 'Password updated. All sessions have been signed out.',
    });
  },

  verify: async (req: AuthRequest, res: Response) => {
    // Signature-only check: verifies JWT signature/expiry + payload shape.
    // Does NOT consult token_version revocation or refresh-token state —
    // use the auth middleware for request authorization. `versionChecked`
    // documents this so callers never mistake `valid: true` for "not revoked".
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Invalid/expired tokens are a client error (401), not a server error —
    // jwt.verify throws, so catch and map to UnauthorizedError.
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: [...JWT_ALGORITHMS],
      });
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const parsed = jwtPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new UnauthorizedError('Invalid token payload');
    }

    res.json({ valid: true, versionChecked: false, user: parsed.data });
  },

  /**
   * Public SPA configuration for Microsoft sign-in. Only the tenant/client
   * IDs are exposed (public by design for a SPA); no secrets involved.
   */
  entraConfig: async (_req: Request, res: Response) => {
    const config = getEntraConfig();
    if (!config) {
      res.json({ enabled: false });
      return;
    }
    res.json({ enabled: true, clientId: config.clientId, tenantId: config.tenantId });
  },

  /**
   * Hybrid Microsoft sign-in: verify the MSAL ID token against the tenant
   * JWKS, require an admin-linked local user, then issue the SAME access +
   * refresh pair as a password login (identical session semantics, role
   * guards, and token_version revocation).
   */
  entraLogin: async (req: Request, res: Response) => {
    if (!getEntraConfig()) {
      throw new ServiceUnavailableError('Microsoft sign-in is not enabled');
    }
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      throw new ValidationError('ID token is required');
    }

    let oid: string;
    try {
      ({ oid } = await verifyEntraIdToken(idToken));
    } catch (err) {
      if (err instanceof EntraVerificationError) {
        await auditService.logAuthEvent({
          action: 'LOGIN_FAILED',
          username: 'unknown',
          ipAddress: req.ip,
          metadata: { method: 'entra', reason: 'invalid_id_token' },
        });
        throw new UnauthorizedError('Invalid Microsoft sign-in token');
      }
      throw err;
    }

    const user = await userModel.findByEntraOid(oid);
    if (!user) {
      // No JIT provisioning: unknown Microsoft accounts must be linked by
      // an admin first. 403 (not 401) so clients can show "contact admin".
      await auditService.logAuthEvent({
        action: 'LOGIN_FAILED',
        username: 'unknown',
        ipAddress: req.ip,
        metadata: { method: 'entra', reason: 'unlinked_oid' },
      });
      throw new ForbiddenError('Microsoft account is not linked to a user. Contact an administrator.');
    }

    const { token, refreshToken } = await issueTokenPair(user);
    await auditService.logAuthEvent({
      action: 'LOGIN',
      username: user.username,
      userId: user.id,
      ipAddress: req.ip,
      metadata: { method: 'entra' },
    });
    res.json({ token, refreshToken, user: publicUserFromRecord(user) });
  },
};
