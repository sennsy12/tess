import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/userModel.js';
import { ValidationError, UnauthorizedError } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../middleware/auth.js';

const SALT_ROUNDS = 10;

function jwtClaimsFromUser(user: {
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

function publicUserFromRecord(user: {
  id: number;
  username: string;
  role: string;
  kundenr?: string | null;
}) {
  return jwtClaimsFromUser(user);
}

/**
 * Get JWT secret - fails fast in production if not configured
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET is not defined in production environment!');
    }
    console.warn('⚠️ WARNING: JWT_SECRET not set. Using dev-only fallback. Set JWT_SECRET in .env for security.');
    return 'dev-only-fallback-secret-do-not-use-in-production';
  }
  return secret;
}

export const authController = {
  login: async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const user = await userModel.findByUsername(username);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = jwt.sign(
      jwtClaimsFromUser(user),
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: publicUserFromRecord(user),
    });
  },

  loginKunde: async (req: Request, res: Response) => {
    const { kundenr, password } = req.body;

    if (!kundenr || !password) {
      throw new ValidationError('Kundenr and password are required');
    }

    const user = await userModel.findByKundenr(kundenr);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const token = jwt.sign(
      jwtClaimsFromUser(user),
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: publicUserFromRecord(user),
    });
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

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await userModel.update(userId, { passwordHash });

    res.json({ success: true, message: 'Password updated' });
  },

  verify: async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());
    res.json({ valid: true, user: decoded });
  }
};

