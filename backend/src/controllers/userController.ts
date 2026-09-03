import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { userModel } from '../models/userModel.js';
import { ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import { assertAdminActionKey } from '../lib/actionKey.js';
import { buildListResponse } from '../lib/listResponse.js';
import { hashPassword } from '../lib/password.js';
import { userListQuerySchema, userSearchQuerySchema } from '../middleware/validation.js';

/**
 * User Controller
 * HTTP handlers for user management endpoints (admin only)
 */
export const userController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const { page, limit } = req.query as unknown as z.infer<typeof userListQuerySchema>;
    const { data, total } = await userModel.getAll(page, limit);
    res.json(buildListResponse(data, { page, limit, total }));
  },

  search: async (req: AuthRequest, res: Response) => {
    const { q, search, limit } = req.query as unknown as z.infer<typeof userSearchQuerySchema>;
    const term = (q ?? search ?? '').trim();
    if (!term) {
      res.json({ data: [] });
      return;
    }
    const data = await userModel.search(term, limit);
    res.json({ data });
  },

  getById: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const user = await userModel.findById(id);
    if (!user) throw new NotFoundError('User not found');

    res.json(user);
  },

  create: async (req: AuthRequest, res: Response) => {
    const { username, password, role, kundenr } = req.body;

    const existing = await userModel.findByUsername(username);
    if (existing) {
      throw new ValidationError('A user with this username already exists');
    }

    if (role === 'kunde' && !kundenr) {
      throw new ValidationError('Kundenr is required for customer (kunde) users');
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.create(username, passwordHash, role, kundenr);

    res.status(201).json(user);
  },

  update: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const existing = await userModel.findById(id);
    if (!existing) throw new NotFoundError('User not found');

    const { username, password, role, kundenr, actionKey } = req.body;

    if (username && username !== existing.username) {
      const duplicate = await userModel.findByUsername(username);
      if (duplicate) {
        throw new ValidationError('A user with this username already exists');
      }
    }

    const effectiveRole = role ?? existing.role;
    const effectiveKundenr = kundenr !== undefined ? kundenr : existing.kundenr;
    if (effectiveRole === 'kunde' && !effectiveKundenr) {
      throw new ValidationError('Kundenr is required for customer (kunde) users');
    }

    const fields: {
      username?: string;
      passwordHash?: string;
      role?: string;
      kundenr?: string | null;
    } = {};
    if (username) fields.username = username;
    if (password) {
      assertAdminActionKey(actionKey, 'password change');
      fields.passwordHash = await hashPassword(password);
    }
    if (role) fields.role = role;
    if (kundenr !== undefined) fields.kundenr = kundenr || null;

    const updated = await userModel.update(id, fields);
    res.json(updated);
  },

  delete: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    if (req.user?.id === id) {
      throw new ValidationError('You cannot delete your own account');
    }

    const { actionKey } = req.body;
    assertAdminActionKey(actionKey, 'delete user');

    const deleted = await userModel.delete(id);
    if (!deleted) throw new NotFoundError('User not found');

    res.json({ message: 'User deleted successfully' });
  },

  linkEntra: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const { entraOid, entraUpn, actionKey } = req.body as {
      entraOid?: string;
      entraUpn?: string;
      actionKey?: string;
    };
    // Linking changes how the account authenticates — same bar as passwords.
    assertAdminActionKey(actionKey, 'link Microsoft account');

    const existing = await userModel.findById(id);
    if (!existing) throw new NotFoundError('User not found');

    const linked = await userModel.findByEntraOid(entraOid as string);
    if (linked && linked.id !== id) {
      throw new ValidationError('This Microsoft account is already linked to another user');
    }

    const updated = await userModel.linkEntra(id, entraOid as string, entraUpn);
    res.json(updated);
  },

  unlinkEntra: async (req: AuthRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new ValidationError('Invalid user ID');

    const { actionKey } = req.body as { actionKey?: string };
    assertAdminActionKey(actionKey, 'unlink Microsoft account');

    const existing = await userModel.findById(id);
    if (!existing) throw new NotFoundError('User not found');

    const updated = await userModel.unlinkEntra(id);
    res.json(updated);
  },
};
