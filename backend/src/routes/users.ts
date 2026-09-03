import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { userController } from '../controllers/userController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validate,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  entraLinkSchema,
  userListQuerySchema,
  userSearchQuerySchema,
} from '../middleware/validation.js';

export const usersRouter = Router();

usersRouter.use(authMiddleware);
usersRouter.use(roleGuard('admin'));

usersRouter.get('/', validate(userListQuerySchema, 'query'), asyncHandler(userController.getAll));

usersRouter.get('/search', validate(userSearchQuerySchema, 'query'), asyncHandler(userController.search));

usersRouter.get('/:id', asyncHandler(userController.getById));

usersRouter.post('/', validate(createUserSchema), asyncHandler(userController.create));

usersRouter.put('/:id', validate(updateUserSchema), asyncHandler(userController.update));

usersRouter.delete('/:id', validate(deleteUserSchema), asyncHandler(userController.delete));

usersRouter.post('/:id/entra-link', validate(entraLinkSchema), asyncHandler(userController.linkEntra));

usersRouter.delete('/:id/entra-link', validate(deleteUserSchema), asyncHandler(userController.unlinkEntra));
