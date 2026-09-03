import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/userModel.js';
import {
  refreshTokenModel,
  REFRESH_TOKEN_TTL_MS,
} from '../models/refreshTokenModel.js';
import { ValidationError, UnauthorizedError, ForbiddenError, ServiceUnavailableError } from '../middleware/errorHandler.js';
import { jwtPayloadSchema, invalidateTokenVersionCache, type AuthRequest } from '../middleware/auth.js';
import { getJwtSecret, JWT_ALGORITHMS } from '../lib/jwt.js';
import { getEntraConfig } from '../lib/entra.js';
import { verifyEntraIdToken, EntraVerificationError } from '../lib/entraVerify.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

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

/** Issue an access + refresh token pair after successful credential checks. */
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
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { token, refreshToken } = await issueTokenPair(user);
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
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { token, refreshToken } = await issueTokenPair(user);
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
      await refreshTokenModel.revoke(refreshToken);
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

    res.json({ valid: true, user: parsed.data });
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
        throw new UnauthorizedError('Invalid Microsoft sign-in token');
      }
      throw err;
    }

    const user = await userModel.findByEntraOid(oid);
    if (!user) {
      // No JIT provisioning: unknown Microsoft accounts must be linked by
      // an admin first. 403 (not 401) so clients can show "contact admin".
      throw new ForbiddenError('Microsoft account is not linked to a user. Contact an administrator.');
    }

    const { token, refreshToken } = await issueTokenPair(user);
    res.json({ token, refreshToken, user: publicUserFromRecord(user) });
  },
};
