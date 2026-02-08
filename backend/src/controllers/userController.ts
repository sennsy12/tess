import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth.js';
import { userModel } from '../models/userModel.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { assertAdminActionKey } from '../lib/actionKey.js';

const SALT_ROUNDS = 10;

/**
 * User Controller
 * HTTP handlers for user management endpoints (admin only)
 */
export const userController = {
  /**
   * GET /api/users
   * List all users with pagination (password hashes are never returned)
   */
  getAll: async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const { data, total } = await userModel.getAll(page, limit);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  /**
   * GET /api/users/:id
   * Get a single user by ID
   */
  getById: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const user = await userModel.findById(id);
    if (!user) throw new NotFoundError('User not found');

    res.json(user);
  },

  /**
   * POST /api/users
   * Create a new user
   */
  create: async (req: AuthRequest, res: Response) => {
    const { username, password, role, kundenr, actionKey } = req.body;

    // Check for duplicate username
    const existing = await userModel.findByUsername(username);
    if (existing) {
      throw new ValidationError('A user with this username already exists');
    }

    // If role is 'kunde', kundenr should be provided
    if (role === 'kunde' && !kundenr) {
      throw new ValidationError('Kundenr is required for customer (kunde) users');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userModel.create(username, passwordHash, role, kundenr);

    res.status(201).json(user);
  },

  /**
   * PUT /api/users/:id
   * Update an existing user
   */
  update: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const existing = await userModel.findById(id);
    if (!existing) throw new NotFoundError('User not found');

    const { username, password, role, kundenr, actionKey } = req.body;

    // If changing username, check it's not already taken by another user
    if (username && username !== existing.username) {
      const duplicate = await userModel.findByUsername(username);
      if (duplicate) {
        throw new ValidationError('A user with this username already exists');
      }
    }

    // If role is 'kunde', kundenr should be provided
    const effectiveRole = role ?? existing.role;
    const effectiveKundenr = kundenr !== undefined ? kundenr : existing.kundenr;
    if (effectiveRole === 'kunde' && !effectiveKundenr) {
      throw new ValidationError('Kundenr is required for customer (kunde) users');
    }

    const fields: { username?: string; passwordHash?: string; role?: string; kundenr?: string | null } = {};
    if (username) fields.username = username;
    if (password) {
      assertAdminActionKey(actionKey, 'password change');
      fields.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    }
    if (role) fields.role = role;
    if (kundenr !== undefined) fields.kundenr = kundenr || null;

    const updated = await userModel.update(id, fields);
    res.json(updated);
  },

  /**
   * DELETE /api/users/:id
   * Delete a user
   */
  delete: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    // Prevent deleting yourself
    if (req.user?.id === id) {
      throw new ValidationError('You cannot delete your own account');
    }

    const { actionKey } = req.body;
    assertAdminActionKey(actionKey, 'delete user');

    const deleted = await userModel.delete(id);
    if (!deleted) throw new NotFoundError('User not found');

    res.json({ message: 'User deleted successfully' });
  },
};
