import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { userController } from '../controllers/userController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, createUserSchema, updateUserSchema, deleteUserSchema } from '../middleware/validation.js';

export const usersRouter = Router();

// All user management routes require admin authentication
usersRouter.use(authMiddleware);
usersRouter.use(roleGuard('admin'));

// GET /api/users - List all users
usersRouter.get('/', asyncHandler(userController.getAll));

// GET /api/users/:id - Get single user
usersRouter.get('/:id', asyncHandler(userController.getById));

// POST /api/users - Create user
usersRouter.post('/', validate(createUserSchema), asyncHandler(userController.create));

// PUT /api/users/:id - Update user
usersRouter.put('/:id', validate(updateUserSchema), asyncHandler(userController.update));

// DELETE /api/users/:id - Delete user
usersRouter.delete('/:id', validate(deleteUserSchema), asyncHandler(userController.delete));
